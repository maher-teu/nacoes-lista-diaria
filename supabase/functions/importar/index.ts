// Recebe lotes de dados vindos da Linx (pelo navegador) e grava no banco.
// Protegido por um segredo (IMPORT_SECRET) guardado nos secrets das Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-import-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TABLES: Record<string, { onConflict?: string }> = {
  customers: { onConflict: "code" },
  purchases: {},
  cycles: { onConflict: "customer_code,list_date" },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const secret = Deno.env.get("IMPORT_SECRET");
  if (!secret || req.headers.get("x-import-secret") !== secret) {
    return json({ error: "forbidden" }, 403);
  }
  let payload: { table?: string; rows?: unknown[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { table, rows } = payload;
  if (!table || !(table in TABLES) || !Array.isArray(rows) || rows.length === 0 || rows.length > 5000) {
    return json({ error: "bad request" }, 400);
  }
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { onConflict } = TABLES[table];
  const { error } = onConflict
    ? await sb.from(table).upsert(rows, { onConflict })
    : await sb.from(table).insert(rows);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, n: rows.length });
});
