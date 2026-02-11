/**
 * Article type constants - single source of truth
 * Used by API endpoints, admin pages, and public UI
 */

export const ARTICLE_TYPES = {
  'expert-insight': { label: 'Expert Insight', badgeClass: 'bg-blue-100 text-blue-800' },
  'case-study': { label: 'Case Study', badgeClass: 'bg-purple-100 text-purple-800' },
  'update-press-release': { label: 'Update & Press Release', badgeClass: 'bg-green-100 text-green-800' },
} as const;

export type ArticleType = keyof typeof ARTICLE_TYPES;
