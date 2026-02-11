/**
 * Markdown rendering and sanitization utilities
 * Single source of truth for both server rendering and admin preview
 */

import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Configure marked for GFM with line breaks
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Sanitization config - exported for admin preview to use identical config
 * Strict allowlist: blocks script, iframe, style, object, embed, form, input
 * Blocks all event handler attributes and style attribute
 */
export const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'strong', 'em', 'b', 'i', 'u', 's', 'a', 'img',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'div', 'span', 'section', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class', 'id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

/**
 * Render markdown/HTML content to sanitized HTML
 * Accepts both markdown and raw HTML - HTML passes through marked then gets sanitized
 */
export function renderMarkdown(content: string): string {
  if (!content) return '';
  const html = marked.parse(content) as string;
  return sanitizeHtml(html, SANITIZE_CONFIG);
}

/**
 * Strip markdown/HTML to plain text (for excerpts, reading time, etc.)
 */
export function stripMarkdown(content: string): string {
  if (!content) return '';
  const html = marked.parse(content) as string;
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}
