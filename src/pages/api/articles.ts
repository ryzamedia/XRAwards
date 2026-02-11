/**
 * Public Articles API Endpoint
 * GET /api/articles - List published articles only (hard-locked)
 */

import type { APIRoute } from 'astro';
import { createSecureSupabaseClient } from '../../utils/supabase';

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const supabase = createSecureSupabaseClient(cookies);

    const type = url.searchParams.get('type');
    const search = url.searchParams.get('search');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Hard-locked to published only - no param can override this
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (type) {
      query = query.eq('article_type', type);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({ articles: data || [], total: count || 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GET articles error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch articles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
