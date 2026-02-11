/**
 * Utilities Index
 * 
 * Central export point for all utility functions
 * Use: import { supabase, getR2ImageUrl } from '@utils';
 */

// R2 image utilities for Cloudflare R2 storage
export {
  getR2ImageUrl,
  getOptimizedR2Image,
  getR2ImageSrcSet,
} from './r2';

// Supabase database client and helpers
export {
  supabase,
  isSupabaseConfigured,
  handleSupabaseError,
  type Database,
} from './supabase';

// General helper utilities
export * from './helpers';

// Markdown rendering utilities
export { renderMarkdown, stripMarkdown } from './markdown';

