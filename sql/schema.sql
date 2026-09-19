-- RxPlain Snowflake schema. Run once; then `npm run seed:snowflake`.
-- Keep the warehouse small with auto-suspend for hackathon cost.
-- ALTER WAREHOUSE <wh> SET WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 300 AUTO_RESUME = TRUE;

CREATE TABLE IF NOT EXISTS INTERACTIONS (
  drug_a      STRING NOT NULL,
  drug_b      STRING NOT NULL,
  severity    STRING NOT NULL,   -- major | moderate | minor | unknown
  mechanism   STRING,
  management  STRING,
  source      STRING DEFAULT 'ddinter'
);

CREATE TABLE IF NOT EXISTS DRUG_CACHE (
  rxcui           STRING PRIMARY KEY,
  name            STRING,
  ingredient_name STRING,
  label_snippets  VARIANT,
  fetched_at      TIMESTAMP_NTZ
);

CREATE TABLE IF NOT EXISTS LABEL_SECTIONS (
  rxcui           STRING NOT NULL,
  ingredient_name STRING,
  section         STRING NOT NULL,   -- dosage_and_administration | overdosage | boxed_warning | warnings | adverse_reactions
  chunk_id        STRING PRIMARY KEY,
  text            STRING NOT NULL,
  set_id          STRING,
  effective_time  STRING
);

-- Optional semantic retrieval. Requires Cortex Search in the account/region.
-- CREATE OR REPLACE CORTEX SEARCH SERVICE LABEL_SEARCH
--   ON text
--   ATTRIBUTES rxcui, section
--   WAREHOUSE = <wh>
--   TARGET_LAG = '1 hour'
--   AS SELECT rxcui, ingredient_name, section, chunk_id, text, set_id, effective_time FROM LABEL_SECTIONS;

CREATE TABLE IF NOT EXISTS DOSE_LIMITS (
  ingredient_name       STRING PRIMARY KEY,
  max_daily_mg          NUMBER,
  max_daily_mg_per_kg   NUMBER,
  route                 STRING,
  source                STRING,
  notes                 STRING
);

CREATE TABLE IF NOT EXISTS CARD_CACHE (
  pair_hash   STRING PRIMARY KEY,
  card_json   VARIANT,
  created_at  TIMESTAMP_NTZ
);

CREATE TABLE IF NOT EXISTS CLINICS (
  clinic_id        STRING PRIMARY KEY,
  name             STRING,
  site_type        STRING,   -- FQHC | LOOKALIKE | RHC
  address          STRING,
  city             STRING,
  state            STRING,
  zip              STRING,
  lat              FLOAT,
  lon              FLOAT,
  phone            STRING,
  npi              STRING,
  accepts_medicaid BOOLEAN,
  accepts_medicare BOOLEAN,
  sliding_fee      BOOLEAN,
  source           STRING,
  updated_at       TIMESTAMP_NTZ
);

CREATE TABLE IF NOT EXISTS CLINIC_CONFIRMATIONS (
  clinic_id        STRING,
  insurance_label  STRING,
  confirmed        BOOLEAN,
  created_at       TIMESTAMP_NTZ
);

CREATE TABLE IF NOT EXISTS ZIP_CENTROIDS (
  zip  STRING PRIMARY KEY,
  lat  FLOAT,
  lon  FLOAT
);

CREATE TABLE IF NOT EXISTS COMMUNITY_POSTS (
  post_id            STRING PRIMARY KEY,
  rxcui              STRING,
  drug_name          STRING,
  body               STRING,
  side_effect_tags   VARIANT,
  moderation_status  STRING,
  created_at         TIMESTAMP_NTZ,
  anon_handle        STRING
);

CREATE TABLE IF NOT EXISTS DEMO_SESSIONS (
  session_id    STRING PRIMARY KEY,
  meds_json     VARIANT,
  results_json  VARIANT,
  updated_at    TIMESTAMP_NTZ
);
