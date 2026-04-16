-- In-article ads: placement inside blog post body after Nth top-level block

ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_placement_check;

ALTER TABLE ads
  ADD CONSTRAINT ads_placement_check
  CHECK (placement IN (
    'sidebar', 'banner', 'in-feed', 'footer', 'inline', 'popup', 'in-article'
  ));

ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS in_article_after_paragraph smallint NOT NULL DEFAULT 2;

COMMENT ON COLUMN ads.in_article_after_paragraph IS
  'For placement in-article: insert the ad after this 1-based top-level content block index (paragraph/heading/list block).';
