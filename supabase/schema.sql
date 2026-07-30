-- Medidor OSIPTEL — esquema Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run

-- 1) Tabla de mediciones
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Identidad del resultado en el cliente
  client_result_id text,
  finished_at timestamptz,
  started_at timestamptz,

  -- Plan / operador
  operator text,
  plan_down_mbps numeric,
  plan_up_mbps numeric,
  technology text,

  -- Red detectada
  access_type text,
  access_label text,
  isp_brand text,
  isp_organization text,
  asn integer,
  client_ip text,

  -- Métricas
  download_mbps numeric,
  upload_mbps numeric,
  latency_ms numeric,
  jitter_ms numeric,
  packet_loss_pct numeric,
  bufferbloat_ms numeric,

  -- CVM
  cvm_pct numeric,
  meets_cvm boolean,
  min_guaranteed_mbps numeric,

  -- GPS del dispositivo
  latitude numeric,
  longitude numeric,
  geo_accuracy_m numeric,
  geo_source text,
  geo_timestamp timestamptz,

  -- Meta
  confidence_score integer,
  confidence_level text,
  protocol_version text,
  client_version text,
  server_id text,
  run_index integer,
  run_total integer,
  signature_hash text,

  -- Payload completo (opcional, para auditoría)
  payload jsonb
);

create index if not exists measurements_finished_at_idx
  on public.measurements (finished_at desc nulls last);

create index if not exists measurements_created_at_idx
  on public.measurements (created_at desc);

create index if not exists measurements_operator_idx
  on public.measurements (operator);

create index if not exists measurements_geo_idx
  on public.measurements (latitude, longitude)
  where latitude is not null and longitude is not null;

-- 2) Row Level Security
alter table public.measurements enable row level security;

-- Cualquiera (app pública) puede INSERTAR mediciones
drop policy if exists "public_insert_measurements" on public.measurements;
create policy "public_insert_measurements"
  on public.measurements
  for insert
  to anon, authenticated
  with check (true);

-- Solo usuarios autenticados (admin) pueden LEER
drop policy if exists "admin_select_measurements" on public.measurements;
create policy "admin_select_measurements"
  on public.measurements
  for select
  to authenticated
  using (true);

-- Nota: los INSERT de la app pública NO deben hacer RETURNING/select.
-- anon puede insertar; solo authenticated puede leer.

-- Solo admin autenticado puede borrar (opcional)
drop policy if exists "admin_delete_measurements" on public.measurements;
create policy "admin_delete_measurements"
  on public.measurements
  for delete
  to authenticated
  using (true);

-- 3) Crear usuario admin en:
-- Authentication → Users → Add user (email + password)
-- Ese usuario podrá entrar en «Acceso admin» de la app.
