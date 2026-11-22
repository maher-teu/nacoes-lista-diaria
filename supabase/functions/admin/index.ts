// Tarefas de administração: criar os logins da loja e da dona, trocar senha, gerar a lista.
// Protegido por um segredo (ADMIN_SECRET) guardado nos secrets das Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const secret = Deno.env.get("ADMIN_SECRET");
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return json({ error: "forbidden" }, 403);
  }
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  async function findUser(email: string) {
    for (let page = 1; page < 20; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (hit) return hit;
      if (data.users.length < 200) return null;
    }
    return null;
  }

  try {
    if (action === "upsert_user") {
      const { email, password, role, display_name } = body;
      if (!email || !password || !["loja", "dona"].includes(role)) return json({ error: "bad request" }, 400);
      let user = await findUser(email);
      if (user) {
        const { error } = await sb.auth.admin.updateUserById(user.id, { password, email_confirm: true });
        if (error) throw error;
      } else {
        const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) throw error;
        user = data.user;
      }
      const { error: pe } = await sb.from("profiles").upsert({ user_id: user!.id, role, display_name: display_name ?? null });
      if (pe) throw pe;
      return json({ ok: true, user_id: user!.id, email, role });
    }
    if (action === "generate_list") {
      const { data, error } = await sb.rpc("generate_daily_list", {
        p_date: body.date ?? null,
        p_force: !!body.force,
      });
      if (error) throw error;
      return json({ ok: true, created: data });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
