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
    const judge = url.searchParams.get('judge');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let data: any[] | null = null;
    let error: any = null;
    let count: number | null = null;

    if (judge) {
      // Filter articles by judge via junction table
      const result = await supabase
        .from('article_judges')
        .select(`
          articles!inner (*)
        `, { count: 'exact' })
        .eq('judge_id', judge)
        .eq('articles.is_published', true)
        .order('articles(published_at)', { ascending: false });

      error = result.error;
      count = result.count;
      data = result.data?.map((row: any) => row.articles) || [];
    } else {
      // Standard query - hard-locked to published only
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

      const result = await query;
      data = result.data;
      error = result.error;
      count = result.count;
    }

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
