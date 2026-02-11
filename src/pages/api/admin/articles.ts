/**
 * Admin Articles API Endpoint
 * All methods require authentication
 * GET /api/admin/articles - List all articles (drafts + published) with relationships
 * POST /api/admin/articles - Create article with relationships
 * PUT /api/admin/articles - Update article with relationships
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
      .select(`
        *,
        article_finalists (
          finalist_id,
          finalists (id, title, organization)
        ),
        article_judges (
          judge_id,
          judges (id, first_name, last_name, organization)
        ),
        article_sponsors (
          sponsor_id,
          sponsors (id, name)
        )
      `, { count: 'exact' })
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

    // Transform to include flat relationship arrays
    const articles = (data || []).map(article => ({
      ...article,
      finalists: article.article_finalists?.map((af: any) => af.finalists) || [],
      judges: article.article_judges?.map((aj: any) => aj.judges) || [],
      sponsors: article.article_sponsors?.map((as_: any) => as_.sponsors) || [],
    }));

    return new Response(
      JSON.stringify({ articles, total: count || 0 }),
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
      edition, sections, is_published, published_at, meta_title, meta_description,
      finalist_ids, judge_ids, sponsor_ids,
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

    // Use provided published_at, or default to now on first publish
    if (published_at) {
      articleData.published_at = published_at;
    } else if (is_published) {
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

    // Add finalist relationships
    if (finalist_ids && finalist_ids.length > 0) {
      const inserts = finalist_ids.map((finalist_id: string) => ({
        article_id: data.id,
        finalist_id,
      }));
      const { error: fErr } = await supabase.from('article_finalists').insert(inserts);
      if (fErr) console.error('Error adding finalists:', fErr);
    }

    // Add judge relationships
    if (judge_ids && judge_ids.length > 0) {
      const inserts = judge_ids.map((judge_id: string) => ({
        article_id: data.id,
        judge_id,
      }));
      const { error: jErr } = await supabase.from('article_judges').insert(inserts);
      if (jErr) console.error('Error adding judges:', jErr);
    }

    // Add sponsor relationships
    if (sponsor_ids && sponsor_ids.length > 0) {
      const inserts = sponsor_ids.map((sponsor_id: string) => ({
        article_id: data.id,
        sponsor_id,
      }));
      const { error: sErr } = await supabase.from('article_sponsors').insert(inserts);
      if (sErr) console.error('Error adding sponsors:', sErr);
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
      edition, sections, is_published, published_at, meta_title, meta_description,
      finalist_ids, judge_ids, sponsor_ids,
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

    // Use provided published_at, or default to now on first publish
    if (published_at !== undefined) {
      updateData.published_at = published_at;
    } else if (is_published) {
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

    // Update finalist relationships if provided (delete-and-reinsert)
    if (finalist_ids !== undefined) {
      await supabase.from('article_finalists').delete().eq('article_id', id);
      if (finalist_ids.length > 0) {
        const inserts = finalist_ids.map((finalist_id: string) => ({
          article_id: id,
          finalist_id,
        }));
        const { error: fErr } = await supabase.from('article_finalists').insert(inserts);
        if (fErr) console.error('Error updating finalists:', fErr);
      }
    }

    // Update judge relationships if provided
    if (judge_ids !== undefined) {
      await supabase.from('article_judges').delete().eq('article_id', id);
      if (judge_ids.length > 0) {
        const inserts = judge_ids.map((judge_id: string) => ({
          article_id: id,
          judge_id,
        }));
        const { error: jErr } = await supabase.from('article_judges').insert(inserts);
        if (jErr) console.error('Error updating judges:', jErr);
      }
    }

    // Update sponsor relationships if provided
    if (sponsor_ids !== undefined) {
      await supabase.from('article_sponsors').delete().eq('article_id', id);
      if (sponsor_ids.length > 0) {
        const inserts = sponsor_ids.map((sponsor_id: string) => ({
          article_id: id,
          sponsor_id,
        }));
        const { error: sErr } = await supabase.from('article_sponsors').insert(inserts);
        if (sErr) console.error('Error updating sponsors:', sErr);
      }
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
