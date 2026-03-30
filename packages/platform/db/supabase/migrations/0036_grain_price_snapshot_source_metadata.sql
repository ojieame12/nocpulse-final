alter table app.grain_price_snapshots
  add column if not exists source_currency text,
  add column if not exists source_unit text,
  add column if not exists source_close_price numeric(12,4),
  add column if not exists fx_rate_to_cad numeric(12,6);

update app.grain_price_snapshots
set
  source_currency = coalesce(source_currency, 'CAD'),
  source_unit = coalesce(source_unit, 'tonne'),
  source_close_price = coalesce(source_close_price, close_price_cad_per_tonne),
  fx_rate_to_cad = coalesce(fx_rate_to_cad, 1)
where
  source_currency is null
  or source_unit is null
  or source_close_price is null
  or fx_rate_to_cad is null;

alter table app.grain_price_snapshots
  alter column source_currency set default 'CAD',
  alter column source_unit set default 'tonne',
  alter column fx_rate_to_cad set default 1,
  alter column source_currency set not null,
  alter column source_unit set not null,
  alter column source_close_price set not null,
  alter column fx_rate_to_cad set not null;
