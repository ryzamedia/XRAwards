-- Migration: 024_add_articles
-- Description: Add articles table for blog/case studies/expert insights

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  article_type TEXT NOT NULL CHECK (article_type IN ('expert-insight', 'case-study', 'update-press-release')),
  author_name TEXT,
  author_title TEXT,
  company_name TEXT,
  project_name TEXT,
  category_name TEXT,
  edition TEXT,
  sections JSONB DEFAULT '[]',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  meta_title TEXT,
  meta_description TEXT,
  reading_time INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_type ON articles(article_type);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published, published_at DESC);

-- RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published articles"
  ON articles FOR SELECT USING (is_published = true);

CREATE POLICY "Authenticated users can read all articles"
  ON articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert articles"
  ON articles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update articles"
  ON articles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete articles"
  ON articles FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at (matches sponsors pattern)
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_articles_updated_at
  BEFORE UPDATE ON articles FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

-- Comments
COMMENT ON TABLE articles IS 'Blog articles, case studies, and expert insights';
COMMENT ON COLUMN articles.sections IS 'JSONB table of contents: [{number, label, anchor}]';
COMMENT ON COLUMN articles.article_type IS 'One of: expert-insight, case-study, update-press-release';
