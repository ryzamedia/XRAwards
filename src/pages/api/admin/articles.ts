/**
 * Admin Articles API Endpoint
 * All methods require authentication
 * GET /api/admin/articles - List all articles (drafts + published)
 * POST /api/admin/articles - Create article
 * PUT /api/admin/articles - Update article
 * DELETE /api/admin/articles - Delete article
 */

import type { APIRoute } from 'astro';
import { requireApiAuth } from '../../../utils/supabase';
import { slugify, getReadingTime } from '../../../utils/helpers';
import { stripMarkdown } from '../../../utils/markdown';

// GET - List all articles (authenticated: sees drafts + published via RLS)
export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    const authResult = await requireApiAuth(cookies, request);

    if (!authResult.authenticated) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = authResult.supabase;
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status') || 'all';
    const search = url.searchParams.get('search');

    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('article_type', type);
    }

    if (status === 'published') {
      query = query.eq('is_published', true);
    } else if (status === 'draft') {
      query = query.eq('is_published', false);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({ articles: data || [], total: count || 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GET admin articles error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch articles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// POST - Create article
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const authResult = await requireApiAuth(cookies, request);

    if (!authResult.authenticated) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = authResult.supabase;
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const {
      title, slug: customSlug, excerpt, content, featured_image, article_type,
      author_name, author_title, company_name, project_name, category_name,
      edition, sections, is_published, meta_title, meta_description,
    } = body;

    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!article_type) {
      return new Response(
        JSON.stringify({ error: 'Article type is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const slug = customSlug || slugify(title);
    const plainText = stripMarkdown(content);
    const reading_time = getReadingTime(plainText);

    const articleData: Record<string, any> = {
      title, slug, excerpt, content, featured_image, article_type,
      author_name, author_title, company_name, project_name, category_name,
      edition, sections: sections || [], is_published: is_published || false,
      meta_title, meta_description, reading_time,
    };

    // Set published_at on first publish
    if (is_published) {
      articleData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('articles')
      .insert(articleData)
      .select()
      .single();

    if (error) {
      // Handle unique slug violation
      if (error.code === '23505' && error.message?.includes('slug')) {
        return new Response(
          JSON.stringify({ error: 'An article with this slug already exists. Please use a different title or custom slug.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ article: data, message: 'Article created successfully' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST admin articles error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create article' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// PUT - Update article
export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const authResult = await requireApiAuth(cookies, request);

    if (!authResult.authenticated) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = authResult.supabase;
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const {
      id, title, slug, excerpt, content, featured_image, article_type,
      author_name, author_title, company_name, project_name, category_name,
      edition, sections, is_published, meta_title, meta_description,
    } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateData: Record<string, any> = {
      title, slug, excerpt, featured_image, article_type,
      author_name, author_title, company_name, project_name, category_name,
      edition, sections: sections || [], is_published,
      meta_title, meta_description,
    };

    // Recalculate reading time if content changed
    if (content !== undefined) {
      updateData.content = content;
      const plainText = stripMarkdown(content);
      updateData.reading_time = getReadingTime(plainText);
    }

    // Publish rule: set published_at only on first publish (draft -> published)
    if (is_published) {
      // Fetch current article to check existing published_at
      const { data: existing } = await supabase
        .from('articles')
        .select('published_at')
        .eq('id', id)
        .single();

      if (!existing?.published_at) {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.includes('slug')) {
        return new Response(
          JSON.stringify({ error: 'An article with this slug already exists. Please use a different slug.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ article: data, message: 'Article updated successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('PUT admin articles error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to update article' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// DELETE - Delete article
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const authResult = await requireApiAuth(cookies, request);

    if (!authResult.authenticated) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = authResult.supabase;
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: 'Article deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('DELETE admin articles error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to delete article' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
