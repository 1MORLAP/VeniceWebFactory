-- Run with: sqlite3 -header -column lead-funnel/leads.db < lead-funnel/scripts/catalog-summary.sql
-- Cross-batch summary of the lead catalog. Top 20 by conversion-likelihood.

.headers on
.mode column

-- Catalog totals
SELECT '=== CATALOG TOTALS ===' AS section;
SELECT
  COUNT(*) AS total_leads,
  SUM(CASE WHEN filter_status = 'passed' THEN 1 ELSE 0 END) AS passed_filter,
  SUM(CASE WHEN awfulness_score IS NOT NULL THEN 1 ELSE 0 END) AS scored,
  SUM(CASE WHEN purchased_at IS NOT NULL THEN 1 ELSE 0 END) AS sold
FROM leads;

-- Per-batch breakdown
SELECT '=== PER-BATCH BREAKDOWN ===' AS section;
SELECT
  b.id AS batch,
  substr(b.query, 1, 40) AS query,
  b.count_discovered AS disc,
  b.count_passed_filter AS passed,
  b.count_scored AS scored
FROM batches b
ORDER BY b.id;

-- Industry distribution (scored leads only)
SELECT '=== INDUSTRY DISTRIBUTION ===' AS section;
SELECT
  industry,
  COUNT(*) AS n,
  ROUND(AVG(awfulness_score), 1) AS avg_awful,
  ROUND(AVG(tech_age_score), 1) AS avg_tech,
  ROUND(AVG(conversion_likelihood), 1) AS avg_conv
FROM leads
WHERE awfulness_score IS NOT NULL
GROUP BY industry
ORDER BY n DESC;

-- Top 20 by conversion likelihood, cross-batch
SELECT '=== TOP 20 BY CONVERSION-LIKELIHOOD (cross-batch) ===' AS section;
SELECT
  ROUND(conversion_likelihood, 0) AS conv,
  awfulness_score AS awful,
  tech_age_score AS tech,
  ability_to_pay_tier AS pay,
  CASE WHEN site_has_email THEN 'Y' ELSE '-' END AS email,
  industry,
  city || ', ' || state AS location,
  business_name
FROM leads
WHERE conversion_likelihood IS NOT NULL
  AND filter_status = 'passed'
ORDER BY conversion_likelihood DESC
LIMIT 20;

-- Highest tech-age sites (the genuinely ancient ones)
SELECT '=== TOP 10 ANCIENT (highest tech-age, regardless of awfulness) ===' AS section;
SELECT
  tech_age_score AS tech,
  awfulness_score AS awful,
  ROUND(conversion_likelihood, 0) AS conv,
  industry,
  business_name,
  website
FROM leads
WHERE tech_age_score IS NOT NULL
  AND filter_status = 'passed'
ORDER BY tech_age_score DESC
LIMIT 10;
