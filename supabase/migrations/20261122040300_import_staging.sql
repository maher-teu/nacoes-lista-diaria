-- Tabelas de passagem para atualizações vindas da Linx (gênero, últimas compras com data exata).
create table if not exists public.import_gender (code text primary key, gender text not null check (gender in ('F','M')));
create table if not exists public.import_recent (name_norm text primary key, last_date date not null, items text[] not null default '{}');
alter table public.import_gender enable row level security;
alter table public.import_recent enable row level security;
revoke all on public.import_gender, public.import_recent from anon, authenticated;

alter function public.bday_in(date, date) set search_path = public;
alter function public.cat_of(text) set search_path = public;
alter function public.metal_txt(text, boolean, boolean) set search_path = public;
alter function public.today_brt() set search_path = public;
alter function public.norm_txt(text) set search_path = public;

-- Depois de carregar as tabelas de passagem:
-- update public.customers c set gender = g.gender from public.import_gender g where g.code = c.code;
-- update public.customers c set recent_from = r.last_date, recent_to = r.last_date, recent_items = r.items
--   from public.import_recent r where r.name_norm = c.name_norm;
