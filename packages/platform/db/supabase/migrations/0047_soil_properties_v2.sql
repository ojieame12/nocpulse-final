-- Per-depth soil property columns + workspace scoping
-- Extends the field_soil_properties table from 0046 with per-depth
-- field capacity / wilting point values and provider metadata.

ALTER TABLE app.field_soil_properties
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES app.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fc_0_5_pct    real,
  ADD COLUMN IF NOT EXISTS fc_5_15_pct   real,
  ADD COLUMN IF NOT EXISTS fc_15_30_pct  real,
  ADD COLUMN IF NOT EXISTS fc_30_60_pct  real,
  ADD COLUMN IF NOT EXISTS wp_0_5_pct    real,
  ADD COLUMN IF NOT EXISTS wp_5_15_pct   real,
  ADD COLUMN IF NOT EXISTS wp_15_30_pct  real,
  ADD COLUMN IF NOT EXISTS wp_30_60_pct  real,
  ADD COLUMN IF NOT EXISTS provider_path text,
  ADD COLUMN IF NOT EXISTS sampling_method text,
  ADD COLUMN IF NOT EXISTS pixel_count   int,
  ADD COLUMN IF NOT EXISTS raw_metadata  jsonb;

CREATE INDEX IF NOT EXISTS idx_fsp_workspace ON app.field_soil_properties(workspace_id);
