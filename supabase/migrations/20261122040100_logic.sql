-- Lista diária: regras, mensagens e funções que o app chama.
-- Pode ser reaplicado (tudo é create or replace).

-- ---------------------------------------------------------------- utilidades

create or replace function public.today_brt() returns date
language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

create or replace function public.norm_txt(p text) returns text
language sql immutable as $$
  select upper(translate(coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where user_id = auth.uid()
$$;

-- Quem pode chamar: usuários do app (loja/dona), o service role e o agendador (postgres).
create or replace function public.require_staff(p_owner_only boolean default false) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text;
begin
  r := public.my_role();
  if r is null then
    if coalesce(auth.role(), '') = 'service_role'
       or (auth.uid() is null and session_user in ('postgres', 'supabase_admin')) then
      return 'sistema';
    end if;
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_owner_only and r <> 'dona' then
    raise exception 'so_dona' using errcode = '42501';
  end if;
  return r;
end $$;

-- Categoria da peça a partir da descrição da Linx.
create or replace function public.cat_of(p_desc text, out sing text, out plur text, out fem boolean)
language sql immutable as $$
  select m.sing, m.plur, m.fem
  from (values
    ('BRINCO', 'brinco', 'brincos', false),
    ('ARGOLA', 'argola', 'argolas', true),
    ('ARGOLINHA', 'argolinha', 'argolinhas', true),
    ('COLAR', 'colar', 'colares', false),
    ('GARGANTILHA', 'gargantilha', 'gargantilhas', true),
    ('CHOKER', 'choker', 'chokers', true),
    ('CORRENTE', 'corrente', 'correntes', true),
    ('PINGENTE', 'pingente', 'pingentes', false),
    ('PULSEIRA', 'pulseira', 'pulseiras', true),
    ('BRACELETE', 'bracelete', 'braceletes', false),
    ('TORNOZELEIRA', 'tornozeleira', 'tornozeleiras', true),
    ('ANEL', 'anel', 'anéis', false),
    ('ALIANCA', 'aliança', 'alianças', true),
    ('CONJUNTO', 'conjunto', 'conjuntos', false),
    ('PIERCING', 'piercing', 'piercings', false),
    ('ESCAPULARIO', 'escapulário', 'escapulários', false),
    ('BROCHE', 'broche', 'broches', false),
    ('TIARA', 'tiara', 'tiaras', true),
    ('MEDALHA', 'medalha', 'medalhas', true),
    ('RELOGIO', 'relógio', 'relógios', false)
  ) as m(k, sing, plur, fem)
  where m.k = split_part(public.norm_txt(trim(coalesce(p_desc, ''))), ' ', 1)
$$;

create or replace function public.metal_txt(p_metal text, p_fem boolean, p_plural boolean) returns text
language sql immutable as $$
  select case p_metal
    when 'gold-filled' then 'folhead' || (case when p_fem then 'a' else 'o' end) || (case when p_plural then 's' else '' end) || ' a ouro'
    when 'gold-plated' then 'banhad' || (case when p_fem then 'a' else 'o' end) || (case when p_plural then 's' else '' end) || ' a ouro'
    when 'silver-filled' then 'folhead' || (case when p_fem then 'a' else 'o' end) || (case when p_plural then 's' else '' end) || ' a prata'
    when 'silver-plated' then 'banhad' || (case when p_fem then 'a' else 'o' end) || (case when p_plural then 's' else '' end) || ' a prata'
    when 'silver 925' then 'de prata 925'
    when 'gold 18k' then 'de ouro 18k'
    when 'steel' then 'de aço'
    else '' end
$$;

-- Dias até o próximo aniversário (0 = hoje).
create or replace function public.bday_in(p_birth date, p_date date) returns int
language plpgsql immutable as $$
declare y int := extract(year from p_date)::int; m int; d int; nb date;
begin
  if p_birth is null then return null; end if;
  m := extract(month from p_birth)::int;
  d := extract(day from p_birth)::int;
  if m = 2 and d = 29 then d := 28; end if;
  nb := make_date(y, m, d);
  if nb < p_date then nb := make_date(y + 1, m, d); end if;
  return nb - p_date;
end $$;

-- ---------------------------------------------------------------- mensagem

create or replace function public.build_msg(p_code text, p_date date, p_reasons text[])
returns table (message text, bump text)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.customers;
  s public.settings;
  nome text;
  bd text := '';
  hook text := '';
  camp text := '';
  cta text;
  r text;
  bdays int;
  wdn text;
  fav record;
  it record;
  ci record;
  metal text;
  grp text;
  art text;
  pron text;
  thing text;
  xy int;
  k text;
  cs text[] := '{}';
  ctas text[] := array[
    'Quer que a gente te mande fotos?',
    'Quer que a gente separe algumas pra você ver?',
    'Quer ver algumas fotos?'];
begin
  select * into c from public.customers where code = p_code;
  select * into s from public.settings where id = 1;
  nome := initcap(lower(coalesce(nullif(trim(c.first_name), ''), split_part(c.name, ' ', 1))));
  cta := ctas[1 + (abs(hashtext(c.code)::bigint) % 3)::int];

  foreach r in array coalesce(p_reasons, '{}') loop
    if r like 'aniversario:%' then
      bdays := split_part(r, ':', 2)::int;
      wdn := split_part(r, ':', 3);
      bd := case bdays
        when 0 then 'Hoje é seu aniversário, né? Feliz aniversário!'
        when 1 then 'Amanhã é seu aniversário, né? Feliz aniversário adiantado!'
        else 'Seu aniversário é ' || (case when wdn in ('sábado', 'domingo') then 'neste ' else 'nesta ' end)
             || wdn || ', então já deixamos nosso feliz aniversário adiantado!'
      end;
    end if;
  end loop;

  select * into fav from public.cat_of(c.fav_category);
  metal := public.metal_txt(c.fav_metal, coalesce(fav.fem, false), true);
  if fav.plur is not null then
    grp := fav.plur || (case when fav.fem then ' novas' else ' novos' end)
           || (case when metal <> '' then ' ' || metal else '' end);
  else
    grp := 'peças novas';
  end if;

  if 'conjunto' = any(p_reasons) and coalesce(array_length(c.recent_items, 1), 0) > 0 then
    select * into it from public.cat_of(c.recent_items[1]);
    if it.sing is not null then
      art := case when it.fem then 'a' else 'o' end;
      pron := case when it.fem then 'ela' else 'ele' end;
      thing := it.sing;
    else
      art := 'a'; pron := 'ela'; thing := 'peça';
    end if;
    if public.norm_txt(c.recent_items[1]) like '%ZIRCONIA%' then
      thing := thing || ' de zircônia';
    end if;
    hook := (case when bd <> '' then 'E como está ' else 'Como está ' end) || art || ' ' || thing
            || ' que você levou? Chegaram peças que combinam com ' || pron || ' e formam o conjunto.';
    cta := 'Quer que a gente te mande fotos?';
  elsif 'natal' = any(p_reasons) then
    xy := case when p_date >= make_date(extract(year from p_date)::int, 12, 26)
               then extract(year from p_date)::int else extract(year from p_date)::int - 1 end;
    for k in select jsonb_array_elements_text(coalesce(c.dec_items -> xy::text, '[]'::jsonb)) loop
      select * into ci from public.cat_of(k);
      if ci.sing is not null and not (ci.sing = any(cs)) then
        cs := array_append(cs, ci.sing);
      end if;
    end loop;
    hook := 'No Natal passado você levou '
            || (case coalesce(array_length(cs, 1), 0)
                  when 1 then cs[1]
                  when 2 then cs[1] || ' e ' || cs[2]
                  else 'algumas peças' end)
            || ' com a gente, e a coleção deste ano já chegou.';
    cta := 'Quer que a gente te mande algumas ideias?';
  elsif 'sumida' = any(p_reasons) then
    hook := 'Faz um tempinho que você não passa aqui, e chegaram ' || grp || ' que são a sua cara.';
  elsif fav.plur is not null then
    hook := 'Chegaram ' || grp || ', bem do jeito que você gosta.';
  else
    hook := 'Separamos algumas novidades que combinam com você.';
  end if;

  if coalesce(trim(s.campaign_line), '') <> '' then
    camp := trim(s.campaign_line);
    if right(camp, 1) not in ('.', '!', '?') then camp := camp || '.'; end if;
  end if;

  message := 'Oi ' || nome || ', tudo bem? Aqui é da ' || s.store_name || '. '
             || concat_ws(' ', nullif(bd, ''), nullif(hook, ''), nullif(camp, ''), cta);
  bump := 'Oi ' || nome || ', só passando pra ver se você viu nossa mensagem de hoje cedo. '
          || 'Se quiser, a gente te manda as fotos por aqui mesmo.';
  return next;
end $$;

-- ---------------------------------------------------------------- lista do dia

create or replace function public.generate_daily_list(p_date date default null, p_force boolean default false)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := coalesce(p_date, public.today_brt());
  s public.settings;
  n int := 0;
  y int;
  xy int;
  in_season boolean;
  t10 numeric;
  t30 numeric;
  lo text;
  hi text;
  rec record;
  m record;
  v_reasons text[];
  pos int := 0;
  wdnames text[] := array['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
begin
  perform public.require_staff();
  select * into s from public.settings where id = 1;

  -- arrumação: listas antigas não enviadas expiram, quem não respondeu até ontem encerra
  update public.cycles set status = 'encerrada', closed_at = now(), close_reason = 'expirou', updated_at = now()
   where status = 'pendente' and list_date < d;
  update public.cycles set status = 'encerrada', closed_at = now(), close_reason = 'sem_resposta', updated_at = now()
   where status = 'enviada' and (sent_at at time zone 'America/Sao_Paulo')::date < d;
  update public.cycles set status = 'encerrada', closed_at = now(), close_reason = 'limite_follow_ups', updated_at = now()
   where status = 'respondeu' and followups_done >= s.followup_max;

  if not p_force and exists (select 1 from public.cycles where list_date = d and origin = 'lista') then
    return 0;
  end if;
  if p_force then
    delete from public.cycles where list_date = d and origin = 'lista' and status = 'pendente';
  end if;

  y := extract(year from d)::int;
  xy := case when d >= make_date(y, 12, 26) then y else y - 1 end;
  in_season := d between make_date(y, 10, 15) and make_date(y, 12, 24);
  select percentile_disc(0.9) within group (order by total_spent),
         percentile_disc(0.7) within group (order by total_spent)
    into t10, t30
    from public.customers where total_spent > 0;
  lo := to_char(d - interval '18 months', 'YYYY-MM');
  hi := to_char(d - interval '6 months', 'YYYY-MM');

  for rec in
    with base as (
      select c.code, c.total_spent, c.n_periods,
             public.bday_in(c.birth_date, d) as bdays,
             (in_season and c.dec_items ? xy::text) as natal,
             (c.recent_from is not null and c.recent_to >= d - 21 and c.recent_from <= d - 7
              and c.recent_to < d - 6 and coalesce(array_length(c.recent_items, 1), 0) > 0) as conjunto,
             (c.last_period between lo and hi) as sumida
        from public.customers c
       where c.phone is not null
         and c.excluded_reason is null
         and not c.do_not_contact
         and not (c.recent_to is not null and c.recent_to >= d - 6)
         and not exists (
           select 1 from public.cycles y2
            where y2.customer_code = c.code
              and (y2.list_date = d
                   or y2.status in ('pendente', 'enviada', 'respondeu')
                   or (y2.sent_at is not null and y2.sent_at > now() - make_interval(days => s.rest_days))
                   or (y2.close_reason in ('pulada:nao_mandar', 'pulada:ja_conversando')
                       and y2.list_date > d - s.rest_days)))
    ), scored as (
      select b.*,
             (case when b.bdays between 0 and 6 then 40 else 0 end)
           + (case when b.natal then 30 else 0 end)
           + (case when b.conjunto then 30 else 0 end)
           + (case when b.sumida then 20 else 0 end)
           + (case when b.total_spent > 0 and b.total_spent >= t10 then 25
                   when b.total_spent > 0 and b.total_spent >= t30 then 15 else 0 end)
           + (case when b.n_periods >= 3 then 10 else 0 end) as score
        from base b
    )
    select * from scored where score > 0
     order by score desc, total_spent desc
     limit s.daily_new
  loop
    pos := pos + 1;
    v_reasons := array_remove(array[
      case when rec.bdays between 0 and 6
           then 'aniversario:' || rec.bdays || ':' || wdnames[extract(dow from d + rec.bdays)::int + 1] end,
      case when rec.natal then 'natal' end,
      case when rec.conjunto then 'conjunto' end,
      case when rec.sumida then 'sumida' end,
      case when rec.total_spent > 0 and rec.total_spent >= t10 then 'vip'
           when rec.total_spent > 0 and rec.total_spent >= t30 then 'boa_cliente' end,
      case when rec.n_periods >= 3 then 'frequente:' || rec.n_periods end
    ], null);
    select * into m from public.build_msg(rec.code, d, v_reasons);
    insert into public.cycles (customer_code, list_date, origin, position, score, reasons, message, bump_message)
    values (rec.code, d, 'lista', pos, rec.score, v_reasons, m.message, m.bump)
    on conflict (customer_code, list_date) do nothing;
    n := n + 1;
  end loop;

  insert into public.events (kind, detail) values ('lista_gerada', jsonb_build_object('date', d, 'count', n));
  return n;
end $$;

-- ---------------------------------------------------------------- leitura

create or replace function public.cycle_json(y public.cycles) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(y) || jsonb_build_object('customer', (
    select jsonb_build_object(
      'code', c.code, 'name', c.name, 'first_name', c.first_name, 'phone', c.phone,
      'cidade', c.cidade, 'bairro', c.bairro, 'total_spent', c.total_spent,
      'last_period', c.last_period, 'last_items', c.last_items, 'birth_date', c.birth_date,
      'seller', c.seller, 'n_periods', c.n_periods, 'do_not_contact', c.do_not_contact)
    from public.customers c where c.code = y.customer_code))
$$;

create or replace function public.today_board() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d date := public.today_brt();
  s public.settings;
  r text;
begin
  r := public.require_staff();
  select * into s from public.settings where id = 1;
  return jsonb_build_object(
    'date', d,
    'now', now(),
    'role', r,
    'settings', to_jsonb(s),
    'novos', coalesce((select jsonb_agg(public.cycle_json(y) order by y.position nulls last, y.id)
                         from public.cycles y where y.list_date = d), '[]'::jsonb),
    'lembretes', coalesce((select jsonb_agg(public.cycle_json(y) order by y.bump_due_at)
                             from public.cycles y
                            where y.status = 'enviada' and y.bump_sent_at is null
                              and (y.sent_at at time zone 'America/Sao_Paulo')::date = d), '[]'::jsonb),
    'lembretes_feitos', coalesce((select jsonb_agg(public.cycle_json(y) order by y.bump_sent_at desc)
                                    from public.cycles y
                                   where y.bump_sent_at is not null
                                     and (y.bump_sent_at at time zone 'America/Sao_Paulo')::date = d), '[]'::jsonb),
    'followups', coalesce((select jsonb_agg(public.cycle_json(y) order by y.next_followup_on, y.replied_at)
                             from public.cycles y
                            where y.status = 'respondeu' and y.next_followup_on <= d
                              and y.followups_done < s.followup_max), '[]'::jsonb),
    'followups_feitos', coalesce((select jsonb_agg(public.cycle_json(y) order by y.last_followup_at desc)
                                    from public.cycles y
                                   where y.last_followup_at is not null
                                     and (y.last_followup_at at time zone 'America/Sao_Paulo')::date = d), '[]'::jsonb),
    'conversando', (select count(*) from public.cycles where status = 'respondeu')
  );
end $$;

create or replace function public.search_customers(p_q text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare digits text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
        q text := public.norm_txt(trim(coalesce(p_q, '')));
begin
  perform public.require_staff();
  if length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(t) from (
      select c.code, c.name, c.phone, c.cidade, c.total_spent, c.last_period, c.do_not_contact,
             (select jsonb_build_object('id', y.id, 'status', y.status, 'list_date', y.list_date,
                                        'close_reason', y.close_reason)
                from public.cycles y where y.customer_code = c.code
               order by y.list_date desc, y.id desc limit 1) as last_cycle
        from public.customers c
       where (length(digits) >= 4 and c.phone like '%' || digits || '%')
          or c.name_norm like '%' || q || '%'
       order by c.total_spent desc, c.name
       limit 30) t), '[]'::jsonb);
end $$;

create or replace function public.customer_detail(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.customers;
begin
  perform public.require_staff();
  select * into c from public.customers where code = p_code;
  if not found then return null; end if;
  return to_jsonb(c) - 'dec_items' || jsonb_build_object(
    'cycles', coalesce((select jsonb_agg(public.cycle_json(y) order by y.list_date desc, y.id desc)
                          from (select * from public.cycles where customer_code = p_code
                                 order by list_date desc, id desc limit 10) y), '[]'::jsonb),
    'purchases', case when c.ambiguous_name then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('period', p.period, 'description', p.description, 'paid', p.paid)
                         order by p.period desc, p.id desc)
          from (select * from public.purchases
                 where customer_code = p_code or (customer_code is null and customer_name = c.name_norm)
                 order by period desc, id desc limit 20) p), '[]'::jsonb) end
  );
end $$;

create or replace function public.results_summary(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_today date := public.today_brt(); n int := greatest(1, least(coalesce(p_days, 7), 90));
begin
  perform public.require_staff();
  return jsonb_build_object(
    'dias', (
      select jsonb_agg(to_jsonb(t) order by t.d desc) from (
        select g.dia::date as d,
               count(e.id) filter (where e.kind = 'enviada') as enviadas,
               count(e.id) filter (where e.kind = 'lembrete') as lembretes,
               count(e.id) filter (where e.kind in ('respondeu', 'parar')) as respostas,
               count(e.id) filter (where e.kind = 'follow_up') as follow_ups,
               count(e.id) filter (where e.kind = 'vendeu') as vendas,
               coalesce(sum((e.detail ->> 'value')::numeric) filter (where e.kind = 'vendeu'), 0) as valor
          from generate_series(v_today - (n - 1), v_today, interval '1 day') as g(dia)
          left join public.events e
            on not e.undone and (e.created_at at time zone 'America/Sao_Paulo')::date = g.dia::date
         group by g.dia) t),
    'agora', jsonb_build_object(
      'conversando', (select count(*) from public.cycles where status = 'respondeu'),
      'aguardando', (select count(*) from public.cycles where status = 'enviada'),
      'vendas', (select count(*) from public.cycles where status = 'vendeu'),
      'valor', (select coalesce(sum(sale_value), 0) from public.cycles where status = 'vendeu'),
      'nao_querem', (select count(*) from public.customers where do_not_contact),
      'clientes_com_whatsapp', (select count(*) from public.customers where phone is not null and excluded_reason is null))
  );
end $$;

-- ---------------------------------------------------------------- ações

create or replace function public.log_event(p_cycle public.cycles, p_kind text, p_detail jsonb default '{}'::jsonb)
returns void
language sql volatile security definer set search_path = public as $$
  insert into public.events (cycle_id, customer_code, kind, detail, before, created_by)
  values (p_cycle.id, p_cycle.customer_code, p_kind, coalesce(p_detail, '{}'::jsonb), to_jsonb(p_cycle), auth.uid())
$$;

create or replace function public.mark_sent(p_id bigint, p_message text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare y public.cycles; s public.settings;
begin
  perform public.require_staff();
  select * into s from public.settings where id = 1;
  select * into y from public.cycles where id = p_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if y.status <> 'pendente' then return public.cycle_json(y); end if;
  perform public.log_event(y, 'enviada');
  update public.cycles
     set status = 'enviada', sent_at = now(),
         bump_due_at = now() + make_interval(mins => (s.bump_hours * 60)::int),
         message = coalesce(nullif(trim(p_message), ''), message), updated_at = now()
   where id = p_id returning * into y;
  return public.cycle_json(y);
end $$;

create or replace function public.mark_bump_sent(p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare y public.cycles;
begin
  perform public.require_staff();
  select * into y from public.cycles where id = p_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if y.status <> 'enviada' or y.bump_sent_at is not null then return public.cycle_json(y); end if;
  perform public.log_event(y, 'lembrete');
  update public.cycles set bump_sent_at = now(), updated_at = now() where id = p_id returning * into y;
  return public.cycle_json(y);
end $$;

create or replace function public.mark_replied(p_id bigint, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare y public.cycles; s public.settings;
begin
  perform public.require_staff();
  select * into s from public.settings where id = 1;
  select * into y from public.cycles where id = p_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if not (y.status = 'enviada' or (y.status = 'encerrada' and y.close_reason = 'sem_resposta')) then
    return public.cycle_json(y);
  end if;
  if p_reason = 'nao_quer' then
    perform public.log_event(y, 'parar', jsonb_build_object('reason', p_reason));
    update public.customers set do_not_contact = true where code = y.customer_code;
    update public.cycles set status = 'encerrada', replied_at = now(), reply_reason = p_reason,
           closed_at = now(), close_reason = 'parar', updated_at = now()
     where id = p_id returning * into y;
  elsif p_reason = 'agora_nao' then
    perform public.log_event(y, 'respondeu', jsonb_build_object('reason', p_reason));
    update public.cycles set status = 'encerrada', replied_at = now(), reply_reason = p_reason,
           closed_at = now(), close_reason = 'agora_nao', updated_at = now()
     where id = p_id returning * into y;
  else
    perform public.log_event(y, 'respondeu', jsonb_build_object('reason', p_reason));
    update public.cycles set status = 'respondeu', replied_at = now(), reply_reason = p_reason,
           closed_at = null, close_reason = null, followups_done = 0,
           next_followup_on = public.today_brt() + s.followup_every_days, updated_at = now()
     where id = p_id returning * into y;
  end if;
  return public.cycle_json(y);
end $$;

create or replace function public.mark_followup_sent(p_id bigint, p_message text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare y public.cycles; s public.settings;
begin
  perform public.require_staff();
  select * into s from public.settings where id = 1;
  select * into y from public.cycles where id = p_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if y.status <> 'respondeu' then return public.cycle_json(y); end if;
  perform public.log_event(y, 'follow_up', jsonb_build_object('n', y.followups_done + 1, 'message', p_message));
  update public.cycles
     set followups_done = followups_done + 1, last_followup_at = now(),
         next_followup_on = public.today_brt() + s.followup_every_days, updated_at = now()
   where id = p_id returning * into y;
  if y.followups_done >= s.followup_max then
    update public.cycles set status = 'encerrada', closed_at = now(), close_reason = 'limite_follow_ups'
     where id = p_id returning * into y;
  end if;
  return public.cycle_json(y);
end $$;

create or replace function public.mark_sold(p_id bigint, p_value numeric default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare y public.cycles;
begin
  perform public.require_staff();
  select * into y from public.cycles where id = p_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if y.status = 'vendeu' then return public.cycle_json(y); end if;
  perform public.log_event(y, 'vendeu', jsonb_build_object('value', p_value));
  update public.cycles set status = 'vendeu', sold_at = now(), sale_value = p_value,
         replied_at = coalesce(replied_at, now()), updated_at = now()
   where id = p_id returning * into y;
  return public.cycle_json(y);
end $$;

create or replace function public.close_cycle(p_id bigint, p_reason text default 'encerrada') returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare y public.cycles;
begin
  perform public.require_staff();
  select * into y from public.cycles where id = p_id for update;
  if not found then raise exception 'nao_encontrado'; end if;
  if y.status in ('encerrada', 'vendeu') then return public.cycle_json(y); end if;
  perform public.log_event(y, 'encerrada', jsonb_build_object('reason', p_reason));
  if p_reason = 'pulada:numero_errado' then
    update public.customers set excluded_reason = 'numero_errado'
     where code = y.customer_code and excluded_reason is null;
  end if;
  update public.cycles set status = 'encerrada', closed_at = now(),
         close_reason = coalesce(nullif(p_reason, ''), 'encerrada'), updated_at = now()
   where id = p_id returning * into y;
  return public.cycle_json(y);
end $$;

create or replace function public.stop_customer(p_code text, p_id bigint default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare y public.cycles;
begin
  perform public.require_staff();
  update public.customers set do_not_contact = true where code = p_code;
  if p_id is not null then
    select * into y from public.cycles where id = p_id and customer_code = p_code for update;
    if found and y.status not in ('encerrada', 'vendeu') then
      perform public.log_event(y, 'parar', jsonb_build_object('reason', 'nao_quer'));
      update public.cycles set status = 'encerrada', closed_at = now(), close_reason = 'parar', updated_at = now()
       where id = p_id returning * into y;
      return public.cycle_json(y);
    end if;
  end if;
  insert into public.events (customer_code, kind, detail, created_by)
  values (p_code, 'parar', jsonb_build_object('reason', 'nao_quer'), auth.uid());
  return jsonb_build_object('code', p_code, 'do_not_contact', true);
end $$;

create or replace function public.undo_last(p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare e public.events; b public.cycles; y public.cycles;
begin
  perform public.require_staff();
  select * into e from public.events
   where cycle_id = p_id and not undone and before is not null
   order by id desc limit 1;
  if not found then
    select * into y from public.cycles where id = p_id;
    return public.cycle_json(y);
  end if;
  b := jsonb_populate_record(null::public.cycles, e.before);
  update public.cycles set
    status = b.status, sent_at = b.sent_at, bump_due_at = b.bump_due_at, bump_sent_at = b.bump_sent_at,
    replied_at = b.replied_at, reply_reason = b.reply_reason, followups_done = b.followups_done,
    next_followup_on = b.next_followup_on, last_followup_at = b.last_followup_at,
    sold_at = b.sold_at, sale_value = b.sale_value, closed_at = b.closed_at,
    close_reason = b.close_reason, message = b.message, updated_at = now()
   where id = p_id returning * into y;
  if e.kind = 'parar' then
    update public.customers set do_not_contact = false where code = e.customer_code;
  end if;
  if e.kind = 'encerrada' and e.detail ->> 'reason' = 'pulada:numero_errado' then
    update public.customers set excluded_reason = null
     where code = e.customer_code and excluded_reason = 'numero_errado';
  end if;
  update public.events set undone = true where id = e.id;
  return public.cycle_json(y);
end $$;

-- Coloca uma cliente da busca na lista de hoje.
create or replace function public.start_manual(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare d date := public.today_brt(); c public.customers; y public.cycles; m record; pos int;
begin
  perform public.require_staff();
  select * into c from public.customers where code = p_code;
  if not found then raise exception 'nao_encontrado'; end if;
  if c.phone is null then raise exception 'sem_celular'; end if;
  if c.do_not_contact then raise exception 'nao_quer_mensagens'; end if;
  select * into y from public.cycles
   where customer_code = p_code and (list_date = d or status in ('pendente', 'enviada', 'respondeu'))
   order by id desc limit 1;
  if found then return public.cycle_json(y); end if;
  select coalesce(max(position), 0) + 1 into pos from public.cycles where list_date = d;
  select * into m from public.build_msg(p_code, d, array['manual']);
  insert into public.cycles (customer_code, list_date, origin, position, score, reasons, message, bump_message)
  values (p_code, d, 'manual', pos, 0, array['manual'], m.message, m.bump)
  returning * into y;
  insert into public.events (cycle_id, customer_code, kind, created_by) values (y.id, p_code, 'manual', auth.uid());
  return public.cycle_json(y);
end $$;

create or replace function public.update_settings(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare s public.settings;
begin
  perform public.require_staff(true);
  update public.settings set
    daily_new = coalesce((p ->> 'daily_new')::int, daily_new),
    bump_hours = coalesce((p ->> 'bump_hours')::numeric, bump_hours),
    followup_every_days = coalesce((p ->> 'followup_every_days')::int, followup_every_days),
    followup_max = coalesce((p ->> 'followup_max')::int, followup_max),
    rest_days = coalesce((p ->> 'rest_days')::int, rest_days),
    campaign_line = case when p ? 'campaign_line' then nullif(trim(p ->> 'campaign_line'), '') else campaign_line end,
    updated_at = now()
  where id = 1 returning * into s;
  return to_jsonb(s);
end $$;

-- ---------------------------------------------------------------- permissões

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.today_board(),
  public.search_customers(text),
  public.customer_detail(text),
  public.results_summary(int),
  public.mark_sent(bigint, text),
  public.mark_bump_sent(bigint),
  public.mark_replied(bigint, text),
  public.mark_followup_sent(bigint, text),
  public.mark_sold(bigint, numeric),
  public.close_cycle(bigint, text),
  public.stop_customer(text, bigint),
  public.undo_last(bigint),
  public.start_manual(text),
  public.update_settings(jsonb),
  public.generate_daily_list(date, boolean)
to authenticated;

-- ---------------------------------------------------------------- agenda: todo dia às 7h (10h UTC)

select cron.schedule('gerar-lista-diaria', '0 10 * * *', $$select public.generate_daily_list()$$);
