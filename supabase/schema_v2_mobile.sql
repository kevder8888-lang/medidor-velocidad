-- Opcional: columnas extra para servicio móvil (ejecutar en SQL Editor si quieres filtrar en SQL)
alter table public.measurements
  add column if not exists service_mode text,
  add column if not exists radio_tech text;

create index if not exists measurements_service_mode_idx
  on public.measurements (service_mode);

create index if not exists measurements_radio_tech_idx
  on public.measurements (radio_tech);
