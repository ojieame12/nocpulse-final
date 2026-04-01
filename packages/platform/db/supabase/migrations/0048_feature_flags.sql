-- Feature flags as JSONB on workspace settings.
-- Creates workspace_settings if it does not already exist, then adds
-- a feature_flags column for per-workspace staged rollout.

CREATE TABLE IF NOT EXISTS app.workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES app.workspaces(id) ON DELETE CASCADE,
  feature_flags jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- If the table already existed but lacked feature_flags, add the column.
ALTER TABLE app.workspace_settings
  ADD COLUMN IF NOT EXISTS feature_flags jsonb DEFAULT '{}';

COMMENT ON COLUMN app.workspace_settings.feature_flags IS
  'Per-workspace feature flags for staged rollout. Keys: moisture.useDepletion, ui.showDepletion, etc.';
