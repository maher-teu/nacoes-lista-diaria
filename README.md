# Lista do dia · Nações Shopping (Criciúma)

Every morning at 7:00 the store phone gets a list of customers to message on WhatsApp, each with a ready, personal message built from what they bought. Staff tap a button, WhatsApp opens with the message typed, they send it and mark it done. The app also handles the same-day reminder for people who didn't reply and the follow-ups for people who did.

The app and every message are in Portuguese. This README is in English for Maher.

## How a day works

| When | What the store does |
|---|---|
| Morning | **Novos** tab: send the day's new customers (50 by default). Tap **Abrir no WhatsApp**, send, then **Sim, enviei**. |
| A few hours later (4 by default) | **Lembretes** tab: for each person, check WhatsApp. Replied? Tap **Sim, respondeu** and pick what she said. No reply? Tap **Não, mandar lembrete** and send the bump. |
| Any time | **Follow-ups** tab: people who replied get a message every 2 days, up to 12, until they buy or the conversation is closed. Mark **Comprou** with the value when they buy. |
| Any time | **Clientes**: search by name or phone to mark a reply, a sale, "não quer mais mensagens", or to add someone to today's list. |

Every action has **Desfazer** (undo). Nothing needs a confirm dialog.

## Who picks the 50

Score per customer, highest first, ties broken by total spent:

| Rule | Points |
|---|---|
| Birthday in the next 7 days | +40 |
| Bought last December (only counts from 15 Oct to 24 Dec) | +30 |
| Bought 7 to 21 days ago (complete the set) | +30 |
| Last purchase 6 to 18 months ago | +20 |
| Top 10% spender / top 30% spender | +25 / +15 |
| 3+ purchase periods | +10 |

Never picked: no mobile number, company or test records, bought in the last 7 days, contacted in the last 60 days, in an open conversation, or asked to stop. Messages never include an opt-out line.

## Owner controls (in the app, Resultados tab, owner login)

- Campaign sentence that goes into every new message (e.g. a Christmas offer). Leave blank when there's no campaign.
- New customers per day, hours until the reminder, days between follow-ups, max follow-ups, days before the same customer can be picked again.
- Results: messages, replies, sales and value for today and the last 7 days.

## Where things live

| Piece | Where | Cost |
|---|---|---|
| Code | GitHub `maher-teu/nacoes-lista-diaria` | free |
| App (web page, installable on the phone) | Vercel, deploys automatically from `main` | free plan |
| Database, daily job, logins | Supabase (separate free organization) | free plan |

Customer data lives only in Supabase. **Never commit customer data to this repo** (CSV/XLSX are git-ignored).

## Structure

```
public/                 the app (plain HTML/CSS/JS, no build step)
  config.js             Supabase URL, publishable key, login emails
supabase/migrations/    tables, rules, messages, RPC functions, 7:00 cron job
supabase/functions/
  importar/             receives data batches from the Linx export (needs IMPORT_SECRET)
  admin/                creates/updates the store and owner logins, generates a list (needs ADMIN_SECRET)
```

Without `config.js` filled in, the app opens in demo mode with sample customers (`/?demo=1` forces it).

## Data refresh

The data is a snapshot from Linx (21 Nov 2026). Until the Linx WebService is on, refresh it weekly through the `importar` function. Customers upsert by Linx code; purchases are replaced.

## Roadmap

1. Linx re-pull with customer codes, exact sale dates and gender.
2. Owner screens: pipeline view and multiple scheduled campaigns.
3. Self-serve weekly refresh (owner uploads the Linx exports) or the Linx WebService for nightly sync.
4. Optional: AI-written messages (Claude API, about US$1 to 3 a month).
5. Optional: rep tracking, official WhatsApp API sending.
