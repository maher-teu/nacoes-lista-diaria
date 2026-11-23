-- Presente de aniversário: frase que entra na mensagem de quem faz aniversário (a dona pode mudar ou apagar).
alter table public.settings add column if not exists birthday_line text;
update public.settings
   set birthday_line = 'De presente de aniversário, você ganha 15% de desconto em compras acima de R$ 89,90 🎁'
 where id = 1 and birthday_line is null;

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
    birthday_line = case when p ? 'birthday_line' then nullif(trim(p ->> 'birthday_line'), '') else birthday_line end,
    updated_at = now()
  where id = 1 returning * into s;
  return to_jsonb(s);
end $$;
