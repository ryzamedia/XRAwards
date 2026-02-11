-- Migration: 025_add_article_relationships
-- Description: Add junction tables to link articles to finalists, judges, and sponsors

-- article_finalists: links case studies to finalists
CREATE TABLE IF NOT EXISTS article_finalists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  finalist_id UUID NOT NULL REFERENCES finalists(id) ON DELETE CASCADE,
  UNIQUE(article_id, finalist_id)
);

CREATE INDEX IF NOT EXISTS idx_article_finalists_article ON article_finalists(article_id);
CREATE INDEX IF NOT EXISTS idx_article_finalists_finalist ON article_finalists(finalist_id);

ALTER TABLE article_finalists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read article_finalists"
  ON article_finalists FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert article_finalists"
  ON article_finalists FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update article_finalists"
  ON article_finalists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete article_finalists"
  ON article_finalists FOR DELETE TO authenticated USING (true);

-- article_judges: links expert insights to judges
CREATE TABLE IF NOT EXISTS article_judges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  UNIQUE(article_id, judge_id)
);

CREATE INDEX IF NOT EXISTS idx_article_judges_article ON article_judges(article_id);
CREATE INDEX IF NOT EXISTS idx_article_judges_judge ON article_judges(judge_id);

ALTER TABLE article_judges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read article_judges"
  ON article_judges FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert article_judges"
  ON article_judges FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update article_judges"
  ON article_judges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete article_judges"
  ON article_judges FOR DELETE TO authenticated USING (true);

-- article_sponsors: links articles to sponsors
CREATE TABLE IF NOT EXISTS article_sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  UNIQUE(article_id, sponsor_id)
);

CREATE INDEX IF NOT EXISTS idx_article_sponsors_article ON article_sponsors(article_id);
CREATE INDEX IF NOT EXISTS idx_article_sponsors_sponsor ON article_sponsors(sponsor_id);

ALTER TABLE article_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read article_sponsors"
  ON article_sponsors FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert article_sponsors"
  ON article_sponsors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update article_sponsors"
  ON article_sponsors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete article_sponsors"
  ON article_sponsors FOR DELETE TO authenticated USING (true);

-- Comments
COMMENT ON TABLE article_finalists IS 'Junction table linking articles (case studies) to finalists';
COMMENT ON TABLE article_judges IS 'Junction table linking articles (expert insights) to judges';
COMMENT ON TABLE article_sponsors IS 'Junction table linking articles to sponsors';
