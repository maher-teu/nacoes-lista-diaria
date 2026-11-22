// IA da lista: lê fotos do catálogo e escreve as mensagens do dia com peças do catálogo.
// Ações: ping | describe (peças sem descrição) | write (mensagens pendentes de uma data).
// Acesso: x-admin-secret (agendador) ou login do app (loja/dona; describe só dona).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const URL = Deno.env.get("SUPABASE_URL")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function claude(content: unknown[], system: string, maxTokens = 600) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens + 3000, system, messages: [{ role: "user", content }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `anthropic ${r.status}`);
  const text = (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`resposta sem JSON (${j.stop_reason}): ${JSON.stringify(j.content ?? []).slice(0, 300)}`);
  return JSON.parse(m[0]);
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const CATS = ["BRINCO", "ARGOLA", "COLAR", "GARGANTILHA", "CHOKER", "CORRENTE", "PINGENTE", "PULSEIRA", "BRACELETE",
  "TORNOZELEIRA", "ANEL", "ALIANCA", "CONJUNTO", "PIERCING", "ESCAPULARIO", "TERCO", "OUTRO"];

const WRITE_SYSTEM = `Você é a melhor vendedora e consultora de estilo da Baummer Nações, uma loja de semijoias no Nações Shopping, em Criciúma (SC). Você escreve mensagens de WhatsApp para clientes, em português do Brasil, do jeito que uma vendedora simpática escreveria no celular.

COMO ESCOLHER A PEÇA (pense como uma consultora de semijoias):
Olhe o que a pessoa comprou (tipo de peça, metal, pedra, cor, linha/tema) e escolha no catálogo a peça que mais faz sentido para ELA. Qualquer peça pode ir para qualquer pessoa, e a mesma peça pode ir para várias pessoas se for a melhor para cada uma.
- Completar o conjunto: comprou brinco, ofereça o colar ou a pulseira da mesma família (mesma pedra, cor, formato ou tema). Ex.: brinco de pérola → colar de pérola; brinco ponto de luz → colar ponto de luz; peças verdes → outra peça verde.
- Mesma linha: berloques Emoções → pulseira ou mais berloques Emoções; peças "Van Cleef"/trevo → outra peça trevo; Lis → outra Lis.
- Pingente pede corrente, corrente pede pingente.
- Colares em camadas: quem compra colar ou corrente costuma usar mais de um. Sugira outro de comprimento diferente (choker, 40/45 cm, mais longo), no máximo três juntos.
- Pulseiras se empilham: quem compra pulseira gosta de mix. Sugira uma fina ou um bracelete para usar junto.
- Argolas e brincos pequenos: sugira uma segunda argola menor ou um piercing para montar o "mix de orelha".
- Anel: outro anel para usar junto, ou uma pulseira delicada.
- Equilíbrio: se a peça que ela tem é grande e chamativa, sugira uma delicada para combinar, e vice-versa.
- Metal: por padrão mantenha o mesmo tom (dourado com dourado, prateado com prateado). Misturar só em peças finas e delicadas.
- Religiosas (terço, escapulário, Nossa Senhora, Divino): sugira outra peça religiosa.
- Infantil: ela comprou para uma criança. Sugira uma peça infantil ou algo para mãe e filha.
- Homens: se houver peça masculina (corrente, pulseira, pingente masculino), sugira para ele. Se não houver, sugira como presente para alguém especial.

SEJA ESPECÍFICA, SEMPRE COM O QUE E O PORQUÊ:
1. O QUE: diga exatamente qual é a peça (tipo, metal, pedra, cor, formato, tamanho quando ajudar).
2. POR QUE: diga por que você escolheu essa peça para ELA, ligando com o que ela comprou (ex.: "faz conjunto com o brinco de pérola que você levou", "fica lindo em camadas com a sua corrente de 40 cm", "é a base para os seus berloques Emoções").
Nunca escreva coisas vagas como "temos outras peças douradas" ou "tem a sua cara" sem dizer o motivo. Se o que ela comprou não tem ligação com joias (ex.: óculos de sol), use outro motivo verdadeiro e diga qual (presente de Natal, aniversário, peça fácil de usar todo dia).

COMO ESCREVER:
- Tom alegre e carinhoso, com 2 a 4 emojis espalhados no texto.
- Comece cumprimentando pelo primeiro nome e diga "Aqui é da Baummer Nações".
- No máximo 4 ou 5 frases curtas.
- Cada frase sozinha numa linha, com uma linha em branco entre as frases (no JSON use \\n\\n entre as frases).
- Se o aniversário estiver perto (motivo "aniversario"), dê parabéns primeiro.
- Decida se é homem ou mulher pelo primeiro nome. O cadastro às vezes está errado: se o nome for claramente feminino (ex.: Caroline, Luisa, Daiane), trate como mulher.
- Varie o começo e o jeito de escrever. Evite repetir sempre "deu saudade".
- Termine perguntando se pode mandar a foto da peça.
- Nunca escreva código, referência nem preço.
- Não use travessão. Não use palavras de propaganda como "incrível", "imperdível", "maravilhoso", "exclusivo". Não invente promoção, desconto nem prazo.
- Nunca coloque frase para sair da lista ou parar de receber mensagens.
- Se houver "frase da campanha", inclua a ideia dela com naturalidade.

Responda só com JSON: {"ref": "<ref da peça escolhida>", "message": "<mensagem>", "bump": "<lembrete curto e alegre para mandar 4 horas depois se não responder, sem repetir a peça>"}`;

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
    if (body.limit) q = q.limit(Number(body.limit));
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
        // O catálogo inteiro (sem repetir descrições iguais), as mais parecidas com o gosto dela primeiro.
        const seen = new Set<string>();
        const shortlist = [...catalog]
          .sort((x, y) => score(y) - score(x))
          .filter((it) => { const k = String(it.description).toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true; })
          .map((it) => ({ ref: it.ref, peca: it.description, tipo: it.category, metal: it.metal }));
        const profile = {
          primeiro_nome: (c.first_name || c.name || "").split(" ")[0],
          genero_no_cadastro: c.gender === "M" ? "homem" : c.gender === "F" ? "mulher" : "não sabemos",
          motivos: cy.reasons,
          ultimas_compras: c.last_items,
          compra_recente: c.recent_items,
          categoria_favorita: c.fav_category,
          metal_favorito: c.fav_metal,
          comprou_no_natal: c.dec_items,
          frase_da_campanha: settings?.campaign_line ?? null,
        };
        const r = await claude([{ type: "text", text: `Cliente:\n${JSON.stringify(profile)}\n\nCatálogo da semana (escolha a melhor peça para esta cliente):\n${JSON.stringify(shortlist)}` }], WRITE_SYSTEM, 500);
        const ref = shortlist.some((s) => s.ref === String(r.ref)) ? String(r.ref) : null;
        const lines = (t: string) => t.replace(/\r/g, "").split(/\n+/).map((x) => x.trim()).filter(Boolean).join("\n\n");
        const message = lines(String(r.message ?? "").replace(/\s*[—–]\s*/g, ", "));
        if (!message) throw new Error("mensagem vazia");
        await sb.from("cycles").update({
          message, bump_message: lines(String(r.bump ?? "").replace(/\s*[—–]\s*/g, ", ")) || undefined,
          catalog_ref: ref, ai: true, updated_at: new Date().toISOString(),
        }).eq("id", cy.id).eq("status", "pendente");
        written++;
      } catch (e) { errors.push(`${cy.id}: ${(e as Error).message}`); }
    });
    return json({ ok: true, date, written, errors: errors.slice(0, 5) });
  }

  return json({ error: "acao_desconhecida" }, 400);
});
