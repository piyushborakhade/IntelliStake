-- IntelliStake V3 Supabase schema
-- Run this once in Supabase Dashboard -> SQL Editor.
-- This is demo-friendly: RLS is intentionally disabled because the app uses its
-- own capstone JWT/session layer and Flask as the write gateway.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  role text,
  kyc_tier text,
  wallet_address text,
  created_at timestamptz default now()
);

create table if not exists portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  startup_name text not null,
  sector text,
  allocation_pct double precision,
  trust_score double precision,
  invested_amount double precision,
  created_at timestamptz default now()
);

create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  startup_name text not null,
  added_at timestamptz default now(),
  unique (user_id, startup_name)
);

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  event text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists browse_history (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  startup_name text not null,
  viewed_at timestamptz default now()
);

-- Research datapool tables.
create table if not exists startup_dataset (
  id uuid primary key default gen_random_uuid(),
  startup_name text not null,
  sector text,
  city text,
  country text,
  founded_year integer,
  company_age_years double precision,
  total_funding_usd double precision,
  valuation_usd double precision,
  revenue_usd double precision,
  employees integer,
  trust_score double precision,
  sentiment_cfs double precision,
  github_velocity_score double precision,
  stage text,
  data_source text,
  investors jsonb,
  is_real boolean,
  raw jsonb,
  imported_at timestamptz default now()
);

create table if not exists funding_rounds (
  id uuid primary key default gen_random_uuid(),
  startup_id text,
  startup_name text not null,
  sector text,
  city text,
  country text,
  funding_round text,
  funding_amount_usd double precision,
  lead_investor text,
  founded_year integer,
  estimated_valuation_usd double precision,
  estimated_revenue_usd double precision,
  employee_count integer,
  exited boolean,
  exit_type text,
  tags jsonb,
  funding_date text,
  source text,
  valuation_tier text,
  raw jsonb,
  imported_at timestamptz default now()
);

create table if not exists shap_narratives (
  id uuid primary key default gen_random_uuid(),
  startup_name text not null,
  sector text,
  predicted_valuation_usd double precision,
  actual_valuation_usd double precision,
  trust_score double precision,
  model_confidence double precision,
  narrative_text text,
  features jsonb,
  survival_1yr double precision,
  survival_3yr double precision,
  survival_5yr double precision,
  survival_score double precision,
  raw jsonb,
  imported_at timestamptz default now()
);

create table if not exists finbert_headlines (
  id uuid primary key default gen_random_uuid(),
  headline text,
  source text,
  label text,
  score double precision,
  compound double precision,
  sector text,
  raw jsonb,
  imported_at timestamptz default now()
);

create index if not exists idx_startup_dataset_name on startup_dataset using gin (to_tsvector('simple', startup_name));
create index if not exists idx_startup_dataset_sector on startup_dataset (sector);
create index if not exists idx_startup_dataset_trust on startup_dataset (trust_score desc);
create index if not exists idx_funding_rounds_startup on funding_rounds (startup_name);
create index if not exists idx_shap_narratives_startup on shap_narratives (startup_name);
create index if not exists idx_finbert_headlines_sector on finbert_headlines (sector);

insert into users (email, role, kyc_tier, wallet_address)
values
  ('admin@intellistake.ai', 'ADMIN', 'INSTITUTIONAL', '0xA8F4E9153CD77A4BBE12F91D4C350984719C9C2E'),
  ('pm@intellistake.ai', 'PORTFOLIO_MANAGER', 'ACCREDITED', '0xB3C704F1AE09CE51E49F21BD3F03B519AA4F1A11'),
  ('analyst@intellistake.ai', 'ANALYST', 'RETAIL', '0xC91D7E8B99A109FD775FA1443D9078126917E8B2')
on conflict (email) do update set
  role = excluded.role,
  kyc_tier = excluded.kyc_tier,
  wallet_address = excluded.wallet_address;
