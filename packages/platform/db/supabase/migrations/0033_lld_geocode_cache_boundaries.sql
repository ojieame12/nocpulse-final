-- LLD Geocode Cache Boundaries
-- Persist exact cached polygon geometry alongside centroid/bbox metadata.

alter table app.lld_geocode_cache
  add column if not exists boundary_geojson jsonb;

update app.lld_geocode_cache
set boundary_geojson = jsonb_build_object(
  'type', 'MultiPolygon',
  'coordinates', jsonb_build_array(
    jsonb_build_array(
      jsonb_build_array(
        jsonb_build_array(bbox_west, bbox_north),
        jsonb_build_array(bbox_east, bbox_north),
        jsonb_build_array(bbox_east, bbox_south),
        jsonb_build_array(bbox_west, bbox_south),
        jsonb_build_array(bbox_west, bbox_north)
      )
    )
  )
)
where boundary_geojson is null;

alter table app.lld_geocode_cache
  alter column boundary_geojson set not null;

drop function if exists app.lookup_lld_geocode(text, integer, integer, integer, text);

create function app.lookup_lld_geocode(
  target_quarter text,
  target_section integer,
  target_township integer,
  target_range integer,
  target_meridian text
)
returns table (
  lld_code text,
  boundary_geojson jsonb,
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
    cache.boundary_geojson,
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
