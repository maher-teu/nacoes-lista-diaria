// IA da lista: lê fotos do catálogo e escreve as mensagens do dia com peças do catálogo.
// Ações: ping | describe (peças sem descrição) | write (mensagens pendentes de uma data).
// Acesso: x-admin-secret (agendador) ou login do app (loja/dona; describe só dona).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5";
const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const URL = Deno.env.get("SUPABASE_URL")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function claude(content: unknown[], system: string, maxTokens = 600) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `anthropic ${r.status}`);
  const text = (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("resposta sem JSON");
  return JSON.parse(m[0]);
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const CATS = ["BRINCO", "ARGOLA", "COLAR", "GARGANTILHA", "CHOKER", "CORRENTE", "PINGENTE", "PULSEIRA", "BRACELETE",
  "TORNOZELEIRA", "ANEL", "ALIANCA", "CONJUNTO", "PIERCING", "ESCAPULARIO", "TERCO", "OUTRO"];

const WRITE_SYSTEM = `Você escreve mensagens de WhatsApp para clientes da Baummer Nações, uma loja de semijoias no Nações Shopping, em Criciúma (SC).
Escreva em português do Brasil, do jeito que uma vendedora simpática escreveria no celular.

Regras:
- Tom alegre e carinhoso, com 2 a 4 emojis espalhados no texto.
- Comece cumprimentando pelo primeiro nome e diga "Aqui é da Baummer Nações".
- No máximo 4 frases curtas. Nada de parágrafos longos.
- Se o aniversário estiver perto (motivo "aniversario"), dê parabéns primeiro.
- Recomende UMA peça do catálogo da semana, escolhida pelo que a pessoa já comprou. Fale da peça com palavras normais (tipo, cor, pedra, metal). Nunca escreva código, referência nem preço.
- Se ela comprou algo recentemente (motivo "conjunto"), sugira uma peça que combine com o que ela levou.
- Para homens, sugira a peça como presente para alguém especial.
- Termine perguntando se pode mandar a foto da peça.
- Não use travessão. Não use palavras de propaganda como "incrível", "imperdível", "maravilhoso", "exclusivo". Não invente promoção, desconto nem prazo.
- Nunca coloque frase para sair da lista ou parar de receber mensagens.
- Se houver "frase da campanha", inclua a ideia dela com naturalidade.

Responda só com JSON: {"ref": "<ref da peça escolhida>", "message": "<mensagem>", "bump": "<lembrete curto e alegre para mandar 4 horas depois se ela não responder, sem repetir a peça>"}`;

const DESCRIBE_SYSTEM = `Você descreve fotos de semijoias para uma loja. Responda só com JSON:
{"descricao": "<tipo da peça, cor, pedra e acabamento em até 8 palavras, em português>", "categoria": "<uma de: ${CATS.join(", ")}>", "metal": "<gold-plated | gold-filled | silver-plated | silver-filled | silver 925 | steel | other>"}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "ping");

  // quem está chamando
  let role: string | null = null;
  const secret = req.headers.get("x-admin-secret");
  if (secret) {
    const { data } = await sb.rpc("check_secret", { p_name: "admin_secret", p_value: secret });
    if (data === true) role = "sistema";
  }
  if (!role) {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (jwt) {
      const { data: u } = await sb.auth.getUser(jwt);
      if (u?.user) {
        const { data: p } = await sb.from("profiles").select("role").eq("user_id", u.user.id).maybeSingle();
        role = p?.role ?? null;
      }
    }
  }
  if (!role) return json({ error: "forbidden" }, 403);

  if (action === "ping") {
    if (!KEY) return json({ ok: false, key: false });
    try {
      const r = await claude([{ type: "text", text: 'Responda {"ok": true}' }], "Responda só com JSON.", 20);
      return json({ ok: r.ok === true, key: true, model: MODEL });
    } catch (e) {
      return json({ ok: false, key: true, error: (e as Error).message });
    }
  }
  if (!KEY) return json({ error: "sem_chave_ia" }, 400);

  if (action === "describe") {
    if (role !== "dona" && role !== "sistema") return json({ error: "so_dona" }, 403);
    const { data: items } = await sb.from("catalog_items").select("ref,image_path").eq("active", true).is("description", null);
    let done = 0;
    const errors: string[] = [];
    await pool(items ?? [], 4, async (it) => {
      try {
        const url = `${URL}/storage/v1/object/public/catalogo/${it.image_path}`;
        const r = await claude([
          { type: "image", source: { type: "url", url } },
          { type: "text", text: "Descreva a peça desta página do catálogo." },
        ], DESCRIBE_SYSTEM, 200);
        await sb.from("catalog_items").update({
          description: String(r.descricao ?? "").slice(0, 120),
          category: CATS.includes(String(r.categoria).toUpperCase()) ? String(r.categoria).toUpperCase() : "OUTRO",
          metal: String(r.metal ?? "other"),
          source: "ia",
          updated_at: new Date().toISOString(),
        }).eq("ref", it.ref);
        done++;
      } catch (e) { errors.push(`${it.ref}: ${(e as Error).message}`); }
    });
    return json({ ok: true, described: done, errors: errors.slice(0, 5) });
  }

  if (action === "write") {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const date = body.date ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const { data: catalog } = await sb.from("catalog_items").select("ref,description,category,metal").eq("active", true).not("description", "is", null);
    if (!catalog?.length) return json({ ok: true, written: 0, note: "sem_catalogo" });
    const { data: settings } = await sb.from("settings").select("campaign_line").eq("id", 1).single();
    let q = sb.from("cycles").select("id,customer_code,reasons").eq("list_date", date).eq("status", "pendente");
    if (!body.force) q = q.eq("ai", false);
    const { data: cycles } = await q;
    let written = 0;
    const errors: string[] = [];
    await pool(cycles ?? [], 5, async (cy) => {
      try {
        const { data: c } = await sb.from("customers")
          .select("first_name,name,gender,birth_date,total_spent,n_periods,last_period,fav_category,fav_metal,last_items,recent_items,dec_items")
          .eq("code", cy.customer_code).single();
        if (!c) return;
        const recentCat = (c.recent_items?.[0] ?? "").split(" ")[0]?.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
        const fav = (c.fav_category ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
        const score = (it: { category: string | null; metal: string | null }) =>
          (it.metal && it.metal === c.fav_metal ? 2 : 0) + (it.category === fav ? 2 : 0) + (recentCat && it.category && it.category !== recentCat ? 1 : 0);
        const shortlist = [...catalog].sort((a, b) => score(b) - score(a) || Math.random() - 0.5).slice(0, 15)
          .map((it) => ({ ref: it.ref, peca: it.description }));
        const profile = {
          primeiro_nome: (c.first_name || c.name || "").split(" ")[0],
          genero: c.gender === "M" ? "homem" : c.gender === "F" ? "mulher" : "não sabemos",
          motivos: cy.reasons,
          ultimas_compras: c.last_items,
          compra_recente: c.recent_items,
          categoria_favorita: c.fav_category,
          metal_favorito: c.fav_metal,
          comprou_no_natal: c.dec_items,
          frase_da_campanha: settings?.campaign_line ?? null,
        };
        const r = await claude([{ type: "text", text: `Cliente:\n${JSON.stringify(profile)}\n\nCatálogo da semana (escolha uma):\n${JSON.stringify(shortlist)}` }], WRITE_SYSTEM, 500);
        const ref = shortlist.some((s) => s.ref === String(r.ref)) ? String(r.ref) : null;
        const message = String(r.message ?? "").replace(/\s*[—–]\s*/g, ", ").trim();
        if (!message) throw new Error("mensagem vazia");
        await sb.from("cycles").update({
          message, bump_message: String(r.bump ?? "").replace(/\s*[—–]\s*/g, ", ").trim() || undefined,
          catalog_ref: ref, ai: true, updated_at: new Date().toISOString(),
        }).eq("id", cy.id).eq("status", "pendente");
        written++;
      } catch (e) { errors.push(`${cy.id}: ${(e as Error).message}`); }
    });
    return json({ ok: true, date, written, errors: errors.slice(0, 5) });
  }

  return json({ error: "acao_desconhecida" }, 400);
});
