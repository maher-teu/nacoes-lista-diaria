-- Lista diária: tabelas
-- Todo acesso do app passa por funções RPC (security definer). As tabelas ficam com
-- RLS ligado e sem políticas, então ninguém lê nada direto pela API.

create extension if not exists pg_cron;

create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  daily_new int not null default 50 check (daily_new between 0 and 300),
  bump_hours numeric not null default 4 check (bump_hours between 0 and 12),
  followup_every_days int not null default 2 check (followup_every_days between 1 and 30),
  followup_max int not null default 12 check (followup_max between 0 and 50),
  rest_days int not null default 60 check (rest_days between 7 and 365),
  store_name text not null default 'loja do Nações Shopping',
  campaign_line text,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.customers (
  code text primary key,                  -- código do cliente na Linx
  name text not null,
  name_norm text not null,                -- nome em maiúsculas, sem acento
  first_name text,
  phone text,                             -- 55 + DDD + 9 dígitos, só celular
  bairro text,
  cidade text,
  uf text,
  email text,
  birth_date date,
  customer_since date,
  seller text,
  gender text check (gender in ('F', 'M')),
  ambiguous_name boolean not null default false,   -- outro cliente com o mesmo nome
  total_spent numeric(12, 2) not null default 0,
  n_periods int not null default 0,
  first_period text,                      -- 'AAAA-MM'
  last_period text,                       -- 'AAAA-MM'
  fav_category text,                      -- 'BRINCO', 'PULSEIRA', ...
  fav_metal text,                         -- 'gold-filled', 'silver 925', ...
  last_items text[] not null default '{}',
  dec_items jsonb not null default '{}'::jsonb,    -- {"2025": ["BRINCO", ...]} compras de dezembro
  recent_from date,                       -- última compra conhecida (intervalo)
  recent_to date,
  recent_items text[] not null default '{}',
  excluded_reason text,                   -- 'sem_celular' | 'nao_pessoa'
  do_not_contact boolean not null default false,
  imported_at timestamptz not null default now()
);
create index if not exists customers_name_norm_idx on public.customers (name_norm);
create index if not exists customers_phone_idx on public.customers (phone);

create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  period text not null,                   -- '2019' ou '2024-03'
  customer_name text not null,            -- nome normalizado como veio do relatório
  customer_code text,                     -- preenchido quando vier da Linx com código
  sale_date date,
  product_code text,
  description text,
  reference text,
  unit text,
  quantity numeric(12, 3),
  list_price numeric(12, 2),
  paid numeric(12, 2)
);
create index if not exists purchases_customer_name_idx on public.purchases (customer_name);
create index if not exists purchases_customer_code_idx on public.purchases (customer_code);

create table if not exists public.cycles (
  id bigint generated always as identity primary key,
  customer_code text not null references public.customers (code) on delete cascade,
  list_date date not null,
  origin text not null default 'lista' check (origin in ('lista', 'manual')),
  position int,
  score int,
  reasons text[] not null default '{}',
  message text not null,
  bump_message text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviada', 'respondeu', 'vendeu', 'encerrada')),
  sent_at timestamptz,
  bump_due_at timestamptz,
  bump_sent_at timestamptz,
  replied_at timestamptz,
  reply_reason text,
  followups_done int not null default 0,
  next_followup_on date,
  last_followup_at timestamptz,
  sold_at timestamptz,
  sale_value numeric(12, 2),
  closed_at timestamptz,
  close_reason text,
  updated_at timestamptz not null default now(),
  unique (customer_code, list_date)
);
create index if not exists cycles_list_date_idx on public.cycles (list_date);
create index if not exists cycles_status_idx on public.cycles (status);
create index if not exists cycles_customer_idx on public.cycles (customer_code);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  cycle_id bigint references public.cycles (id) on delete cascade,
  customer_code text,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  before jsonb,
  undone boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists events_created_idx on public.events (created_at);
create index if not exists events_cycle_idx on public.events (cycle_id);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('loja', 'dona')),
  display_name text
);

alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.purchases enable row level security;
alter table public.cycles enable row level security;
alter table public.events enable row level security;
alter table public.profiles enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
