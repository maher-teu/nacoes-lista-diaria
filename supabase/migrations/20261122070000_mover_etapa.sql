-- Arrastar um card no funil: muda a cliente de etapa. Fica registrado em events, então dá para desfazer.
create or replace function public.mover_etapa(p_code text, p_stage text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := public.today_brt();
  s public.settings;
  c public.customers;
  y public.cycles;
  m record;
  pos int;
  created boolean := false;
begin
  perform public.require_staff();
  if p_stage not in ('hoje', 'aguardando', 'conversa', 'vendeu', 'encerrada', 'nao_quer') then
    raise exception 'etapa_invalida';
  end if;
  select * into s from public.settings where id = 1;
  select * into c from public.customers where code = p_code for update;
  if not found then raise exception 'nao_encontrado'; end if;
  select * into y from public.cycles where customer_code = p_code order by list_date desc, id desc limit 1 for update;

  -- Não quer mais mensagens
  if p_stage = 'nao_quer' then
    if y.id is not null then
      perform public.log_event(y, 'parar', jsonb_build_object('reason', 'movida'));
      if y.status in ('pendente', 'enviada', 'respondeu') then
        update public.cycles set status = 'encerrada', closed_at = now(), close_reason = 'parar', updated_at = now()
         where id = y.id;
      end if;
    end if;
    update public.customers set do_not_contact = true where code = p_code;
    return jsonb_build_object('ok', true, 'stage', p_stage, 'cycle_id', y.id, 'created', created);
  end if;

  if c.phone is null then raise exception 'sem_celular'; end if;
  if c.do_not_contact then
    update public.customers set do_not_contact = false where code = p_code;
  end if;

  -- Sem tentativa ainda (ou a última já terminou e vai para a lista de hoje): cria uma para hoje
  if y.id is null or (p_stage = 'hoje' and y.status in ('vendeu', 'encerrada') and y.list_date < d) then
    select coalesce(max(position), 0) + 1 into pos from public.cycles where list_date = d;
    select * into m from public.build_msg(p_code, d, array['manual']);
    insert into public.cycles (customer_code, list_date, origin, position, score, reasons, message, bump_message)
    values (p_code, d, 'manual', pos, 0, array['manual'], m.message, m.bump)
    returning * into y;
    created := true;
    perform public.log_event(y, 'manual');
    if p_stage = 'hoje' then
      return jsonb_build_object('ok', true, 'stage', p_stage, 'cycle_id', y.id, 'created', created);
    end if;
  end if;

  perform public.log_event(y, 'movida', jsonb_build_object('to', p_stage));
  if p_stage = 'hoje' then
    update public.cycles set status = 'pendente', sent_at = null, bump_due_at = null, bump_sent_at = null,
           replied_at = null, reply_reason = null, followups_done = 0, next_followup_on = null,
           last_followup_at = null, sold_at = null, sale_value = null, closed_at = null, close_reason = null,
           list_date = case when exists (select 1 from public.cycles o where o.customer_code = p_code and o.list_date = d and o.id <> y.id)
                            then list_date else d end,
           updated_at = now()
     where id = y.id;
  elsif p_stage = 'aguardando' then
    update public.cycles set status = 'enviada', sent_at = coalesce(sent_at, now()),
           bump_due_at = coalesce(bump_due_at, now() + make_interval(mins => (s.bump_hours * 60)::int)),
           replied_at = null, reply_reason = null, sold_at = null, sale_value = null,
           closed_at = null, close_reason = null, updated_at = now()
     where id = y.id;
  elsif p_stage = 'conversa' then
    update public.cycles set status = 'respondeu', sent_at = coalesce(sent_at, now()),
           replied_at = coalesce(replied_at, now()), reply_reason = coalesce(reply_reason, 'outra'),
           next_followup_on = coalesce(next_followup_on, d + s.followup_every_days),
           sold_at = null, sale_value = null, closed_at = null, close_reason = null, updated_at = now()
     where id = y.id;
  elsif p_stage = 'vendeu' then
    update public.cycles set status = 'vendeu', sent_at = coalesce(sent_at, now()), sold_at = coalesce(sold_at, now()),
           closed_at = null, close_reason = null, updated_at = now()
     where id = y.id;
  else -- encerrada
    update public.cycles set status = 'encerrada', closed_at = now(), close_reason = 'movida', updated_at = now()
     where id = y.id;
  end if;
  return jsonb_build_object('ok', true, 'stage', p_stage, 'cycle_id', y.id, 'created', created);
end $$;

revoke all on function public.mover_etapa(text, text) from public, anon;
grant execute on function public.mover_etapa(text, text) to authenticated;

-- Desfazer também volta a data da lista (o arrastar para "Na lista de hoje" pode mudar a data).
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
  if e.kind = 'manual' then
    -- a tentativa foi criada pelo arrastar: apaga
    delete from public.cycles where id = p_id and status = 'pendente';
    update public.events set undone = true where id = e.id;
    return jsonb_build_object('id', p_id, 'removed', true);
  end if;
  update public.cycles set
    status = b.status, sent_at = b.sent_at, bump_due_at = b.bump_due_at, bump_sent_at = b.bump_sent_at,
    replied_at = b.replied_at, reply_reason = b.reply_reason, followups_done = b.followups_done,
    next_followup_on = b.next_followup_on, last_followup_at = b.last_followup_at,
    sold_at = b.sold_at, sale_value = b.sale_value, closed_at = b.closed_at,
    close_reason = b.close_reason, message = b.message, list_date = b.list_date, updated_at = now()
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
