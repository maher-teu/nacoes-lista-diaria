-- Mensagens v2: tom alegre, com emojis, nome Baummer Nações.
-- Regras (humanizer): frases diretas, sem travessão, sem exagero de venda,
-- sem prometer peça em estoque. A oferta concreta vem só da frase de campanha da dona.

update public.settings set store_name = 'Baummer Nações' where id = 1;
alter table public.settings alter column store_name set default 'Baummer Nações';

create or replace function public.build_msg(p_code text, p_date date, p_reasons text[])
returns table (message text, bump text)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.customers;
  s public.settings;
  nome text;
  v int;
  intro text;
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
  is_m boolean;
begin
  select * into c from public.customers where code = p_code;
  select * into s from public.settings where id = 1;
  nome := initcap(lower(coalesce(nullif(trim(c.first_name), ''), split_part(c.name, ' ', 1))));
  v := (abs(hashtext(c.code)::bigint) % 3)::int;
  is_m := c.gender = 'M';

  intro := case v
    when 0 then 'Oi ' || nome || '! Tudo bem? 😊 Aqui é da ' || s.store_name || '.'
    when 1 then 'Oiê, ' || nome || '! 💛 Aqui é da ' || s.store_name || ', tudo bem?'
    else 'Olá, ' || nome || '! ✨ Aqui é da ' || s.store_name || '.'
  end;

  cta := case v
    when 0 then 'Quer que eu te mande umas fotos? 📸'
    when 1 then 'Posso te mandar umas fotinhas? 📸'
    else 'Quer dar uma olhada? Te mando as fotos por aqui 😉'
  end;

  foreach r in array coalesce(p_reasons, '{}') loop
    if r like 'aniversario:%' then
      bdays := split_part(r, ':', 2)::int;
      wdn := split_part(r, ':', 3);
      bd := case bdays
        when 0 then 'Hoje é seu aniversário, né? Feliz aniversário! 🎉🥳'
        when 1 then 'Amanhã é seu aniversário! Já fica aqui nosso parabéns adiantado 🎂'
        else 'Vi que seu aniversário é ' || (case when wdn in ('sábado', 'domingo') then 'neste ' else 'nesta ' end)
             || wdn || ' 🎉 Parabéns adiantado!'
      end;
    end if;
  end loop;

  select * into fav from public.cat_of(c.fav_category);
  metal := public.metal_txt(c.fav_metal, coalesce(fav.fem, false), true);
  if fav.plur is not null then
    grp := fav.plur || (case when metal <> '' then ' ' || metal else '' end);
  else
    grp := 'semijoias';
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
    hook := 'E aí, tá gostando d' || art || ' ' || thing || ' que você levou? 😍 Se quiser, te mostro peças que combinam com '
            || pron || ' pra fechar o conjunto 💍';
    cta := 'Te mando as fotos? 📸';
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
                  else 'umas peças' end)
            || ' com a gente 🎄 Esse ano a gente quer te ajudar com os presentes de novo 🎁';
    cta := 'Quer umas ideias? Te mando as fotos por aqui 📸';
  elsif 'sumida' = any(p_reasons) then
    hook := (case when is_m then 'Tá sumido! 🥺 ' when c.gender = 'F' then 'Tá sumida! 🥺 '
                  else 'Faz tempo que você não aparece por aqui 🥺 ' end)
            || 'Sentimos sua falta! Tem novidade em ' || grp || ', do jeitinho que você gosta 💛';
  elsif is_m then
    hook := 'Se precisar de um presente pra alguém especial, a gente te ajuda a escolher 🎁';
  elsif fav.plur is not null then
    hook := 'Tem novidade em ' || grp || ', do jeitinho que você gosta 💛';
  else
    hook := 'Passando pra te dar um oi e contar que tem novidade na loja 🛍️';
  end if;

  if coalesce(trim(s.campaign_line), '') <> '' then
    camp := trim(s.campaign_line);
    if right(camp, 1) not in ('.', '!', '?') and camp !~ '[^\x00-\x7F]$' then camp := camp || '!'; end if;
  end if;

  message := concat_ws(' ', intro, nullif(bd, ''), nullif(hook, ''), nullif(camp, ''), cta);
  bump := case v
    when 1 then nome || ', conseguiu ver minha mensagem de hoje cedo? 💛 Qualquer coisa é só me chamar por aqui!'
    else 'Oi ' || nome || '! Só passando pra ver se você viu minha mensagem 😊 Se quiser, te mando as fotos por aqui mesmo!'
  end;
  return next;
end $$;

revoke execute on function public.build_msg(text, date, text[]) from public, anon, authenticated;

-- Gênero pelo primeiro nome, aprendido das clientes que já têm gênero na Linx
-- (só quando 90%+ das pessoas com aquele nome são do mesmo gênero e há 3+ exemplos).
with names as (
  select upper(public.norm_txt(split_part(trim(name), ' ', 1))) fn,
         count(*) filter (where gender = 'F') f, count(*) filter (where gender = 'M') m
    from public.customers where gender is not null group by 1
)
update public.customers c set gender = case when n.f >= 0.9 * (n.f + n.m) then 'F' else 'M' end
  from names n
 where c.gender is null
   and upper(public.norm_txt(split_part(trim(c.name), ' ', 1))) = n.fn
   and n.f + n.m >= 3
   and (n.f >= 0.9 * (n.f + n.m) or n.m >= 0.9 * (n.f + n.m));

-- Refaz as mensagens das listas ainda não enviadas.
update public.cycles y set (message, bump_message) =
  (select m.message, m.bump from public.build_msg(y.customer_code, y.list_date, y.reasons) m)
 where y.status = 'pendente' and y.list_date >= public.today_brt();
