-- LLD Geocode Cache
-- Pre-computed centroid + bounding box for every known legal land description.
-- Eliminates runtime geocoding lookups for known Saskatchewan sections/quarters.

create table if not exists app.lld_geocode_cache (
  id uuid primary key default extensions.gen_random_uuid(),

  -- DLS components (quarter is nullable for section-level entries)
  quarter text,
  section integer not null,
  township integer not null,
  range integer not null,
  meridian text not null,

  -- Canonical LLD string, e.g. "NE-15-35-22-W2" or "15-35-22-W2" (section-level)
  lld_code text not null,

  -- Pre-computed geometry
  centroid_lat numeric(10, 6) not null,
  centroid_lng numeric(10, 6) not null,
  bbox_north numeric(10, 6) not null,
  bbox_south numeric(10, 6) not null,
  bbox_east numeric(10, 6) not null,
  bbox_west numeric(10, 6) not null,

  -- PostGIS point for spatial queries
  centroid_geom extensions.geometry(Point, 4326) generated always as (
    extensions.st_setsrid(
      extensions.st_makepoint(centroid_lng::double precision, centroid_lat::double precision),
      4326
    )
  ) stored,

  -- Provenance
  source_key text not null default 'spreadsheet-seed',
  created_at timestamptz not null default timezone('utc', now()),

  -- Unique constraint: one entry per DLS combination
  constraint lld_geocode_cache_unique unique (quarter, section, township, range, meridian),
  constraint lld_geocode_cache_section_range check (section >= 1 and section <= 36),
  constraint lld_geocode_cache_township_positive check (township >= 1),
  constraint lld_geocode_cache_range_positive check (range >= 1),
  constraint lld_geocode_cache_meridian_format check (meridian ~ '^W[1-6]$'),
  constraint lld_geocode_cache_quarter_format check (quarter is null or quarter in ('NE', 'NW', 'SE', 'SW'))
);

create index if not exists lld_geocode_cache_lld_code_idx
  on app.lld_geocode_cache (lld_code);

create index if not exists lld_geocode_cache_components_idx
  on app.lld_geocode_cache (meridian, township, range, section);

create index if not exists lld_geocode_cache_centroid_gix
  on app.lld_geocode_cache using gist (centroid_geom);

-- Readable by all authenticated users (reference data)
alter table app.lld_geocode_cache enable row level security;

create policy lld_geocode_cache_select_authenticated
  on app.lld_geocode_cache
  for select
  to authenticated
  using (true);

-- Only service_role can insert/update (seeded by scripts, not user-facing)
create policy lld_geocode_cache_write_service
  on app.lld_geocode_cache
  for all
  to service_role
  using (true)
  with check (true);

grant select on app.lld_geocode_cache to authenticated;
grant select, insert, update, delete on app.lld_geocode_cache to service_role;

-- Lookup function: resolve an LLD code to cached centroid + bbox
create or replace function app.lookup_lld_geocode(
  target_quarter text,
  target_section integer,
  target_township integer,
  target_range integer,
  target_meridian text
)
returns table (
  lld_code text,
  centroid_lat numeric,
  centroid_lng numeric,
  bbox_north numeric,
  bbox_south numeric,
  bbox_east numeric,
  bbox_west numeric
)
language sql
stable
security invoker
set search_path = app, public
as $$
  select
    cache.lld_code,
    cache.centroid_lat,
    cache.centroid_lng,
    cache.bbox_north,
    cache.bbox_south,
    cache.bbox_east,
    cache.bbox_west
  from app.lld_geocode_cache cache
  where cache.section = target_section
    and cache.township = target_township
    and cache.range = target_range
    and cache.meridian = target_meridian
    and (
      (target_quarter is null and cache.quarter is null)
      or cache.quarter = target_quarter
    )
  limit 1;
$$;

grant execute on function app.lookup_lld_geocode(text, integer, integer, integer, text)
  to authenticated, service_role;
