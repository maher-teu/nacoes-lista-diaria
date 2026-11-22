// Recebe lotes de dados vindos da Linx (pelo navegador) e grava no banco.
// Protegido por um segredo guardado em private.config (conferido por check_secret).
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
  import_gender: { onConflict: "code" },
  import_recent: { onConflict: "name_norm" },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: allowed } = await sb.rpc("check_secret", {
    p_name: "import_secret",
    p_value: req.headers.get("x-import-secret") ?? "",
  });
  if (allowed !== true) return json({ error: "forbidden" }, 403);
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
  const { onConflict } = TABLES[table];
  const { error } = onConflict
    ? await sb.from(table).upsert(rows, { onConflict })
    : await sb.from(table).insert(rows);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, n: rows.length });
});
