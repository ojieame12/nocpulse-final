-- Soil properties enrichment for fields.
-- Values are fetched from SoilGrids v2 and cached per field.

create table if not exists field_soil_properties (
  field_id       uuid primary key references fields(id) on delete cascade,
  field_capacity_pct       real,   -- volumetric water content at field capacity (wv0033), 0-100 %
  wilting_point_pct        real,   -- volumetric water content at wilting point (wv1500), 0-100 %
  soil_properties_fetched_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table field_soil_properties is
  'Cached soil property data from SoilGrids v2 for the 0-30cm depth layer.';
