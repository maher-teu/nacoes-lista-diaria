# CLAUDE.md

Daily WhatsApp outreach list for a semi-jewelry store (Nações Shopping, Criciúma, SC, Brazil). The store owner and staff are not technical; Maher (the builder) is not technical either. See README.md for the product.

## Rules

- UI text and customer messages are **Portuguese (Brazil)**. Docs for Maher are English.
- Messages: warm, short, specific to what the customer bought. **No opt-out line**, no store legal name, no invented offers or prices. Offers come only from the owner's campaign sentence (`settings.campaign_line`).
- Copy for Maher: no em dashes.
- **Never commit customer data** (names, phones, CSV/XLSX exports). The repo may be public.
- Keep it simple: `public/` is plain HTML/CSS/JS with no build step. Supabase JS comes from jsDelivr.
- Design: Atkinson Hyperlegible, brand `#1d6b4d`, accent `#f2b84b` (fill only), surfaces `#f6f5f1/#ffffff/#eeede7`, 44px+ touch targets, 16px body, one primary action per screen, Undo instead of confirm dialogs.

## Architecture

- Supabase Postgres. Tables have RLS on with **no policies**; the app only calls `security definer` RPC functions, each starting with `require_staff()`. Roles come from `profiles` (`loja`, `dona`).
- `generate_daily_list()` runs at 10:00 UTC (07:00 America/Sao_Paulo) via pg_cron. It expires unsent cards, closes yesterday's non-replies, scores customers, and writes `cycles` with `build_msg()` messages.
- `cycles` = one outreach attempt per customer per day: `pendente → enviada → (respondeu → follow-ups) → vendeu | encerrada`. Every action writes `events` with a `before` snapshot so `undo_last()` can revert it.
- Edge functions: `importar` (batch upserts from the Linx export, header `x-import-secret`) and `admin` (create logins, generate a list, header `x-admin-secret`). Secrets live in Supabase Edge Function secrets, never in code.
- Vercel serves `public/` (see `vercel.json`). Pushing to `main` deploys.

## Changing the database

Add a new file in `supabase/migrations/` (timestamped). Logic functions are `create or replace`, so re-applying `*_logic.sql` is safe. After schema changes, check Supabase security advisors.

## Testing

Open `/?demo=1` for a full offline flow with sample data (the `Demo` module in `app.js` mirrors the RPCs). Test SQL as a user with `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';` inside a transaction.
