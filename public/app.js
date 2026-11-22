/* Lista do dia: tela da loja e da dona.
   Sem build: HTML + JS puro. Fala com o Supabase só por funções RPC. */
(() => {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo') || !CFG.supabaseUrl || !CFG.supabaseKey;
  const TZ = 'America/Sao_Paulo';
  const sb = DEMO ? null : window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  // ------------------------------------------------------------------ estado
  const S = {
    phase: 'loading',        // loading | login | app
    view: 'hoje',            // hoje | clientes | resultados
    tab: 'novos',            // novos | lembretes | followups
    board: null,
    ui: {},                  // passo de cada card: { step: 'confirm' | 'skip' | 'reply' | 'bump' | 'sold' }
    picked: {},              // card escolhido manualmente por aba
    edits: {},               // textos editados: `${id}:${tipo}`
    nextShown: 5,
    search: { q: '', results: null, loading: false },
    sheet: null,
    results: null,
    busy: false,
    login: { role: (() => { try { return localStorage.getItem('lista-role') || 'loja'; } catch (e) { return 'loja'; } })(), error: '', loading: false },
    catalog: [],
    catalogBlobs: {},
    catalogOpen: false,
    uploading: false,
  };

  // ------------------------------------------------------------------ textos fixos
  const REPLY = [
    { k: 'fotos', label: 'Quer ver fotos' },
    { k: 'visita', label: 'Vai passar na loja' },
    { k: 'preco', label: 'Perguntou o preço' },
    { k: 'outro', label: 'Outra resposta' },
    { k: 'agora_nao', label: 'Agora não' },
    { k: 'nao_quer', label: 'Não quer mais mensagens', danger: true },
  ];
  const REPLY_LABEL = Object.fromEntries(REPLY.map((r) => [r.k, r.label]));
  const SKIP = [
    { k: 'numero_errado', label: 'Número errado' },
    { k: 'ja_conversando', label: 'Já estamos conversando' },
    { k: 'nao_mandar', label: 'Melhor não mandar' },
  ];
  const FOLLOWUPS = [
    (n) => `Oi ${n}! 😊 Conseguiu ver as fotos? Se quiser, separo as peças pra você passar aqui na loja 💛`,
    (n) => `Oiê, ${n}! ✨ Ficou alguma dúvida sobre as peças? Posso te mandar mais opções 📸`,
    (n) => `Oi ${n}! Chegou novidade essa semana 😍 Quer que eu te mande umas fotos?`,
    (n) => `${n}, as peças que você gostou ainda estão aqui 💍 Quer que eu reserve pra você?`,
    (n) => `Oi ${n}! Se precisar de um presente, é só me chamar por aqui 🎁`,
    (n) => `Oi ${n}! 💛 Passando pra te dar um oi. Qualquer coisa, estou por aqui!`,
  ];
  const WEEKDAY_FULL = { domingo: 'domingo', segunda: 'segunda', 'terça': 'terça', quarta: 'quarta', quinta: 'quinta', sexta: 'sexta', 'sábado': 'sábado' };

  const I = {
    wa: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    today: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    people: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
    gift: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
    phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>',
  };

  // ------------------------------------------------------------------ formatação
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const time = (ts) => (ts ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(ts)) : '');
  function phoneFmt(p) {
    const d = String(p || '').replace(/\D/g, '');
    const n = d.startsWith('55') ? d.slice(2) : d;
    return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : (p || 'sem celular');
  }
  function dateLong(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function dateShort(iso) {
    if (!iso) return '';
    const [, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}`;
  }
  function period(p) {
    if (!p) return '';
    const [y, m] = p.split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return m ? `${meses[Number(m) - 1]}/${y}` : y;
  }
  function itemTxt(s) {
    return String(s || '').replace(/\s*\(R\$.*\)\s*$/, '').toLowerCase()
      .replace(/\b(pequeno|médio|medio|grande|tendência|tendencia)\b/g, '').replace(/\s+/g, ' ').trim();
  }
  function fname(cu) {
    const f = String((cu && (cu.first_name || cu.name)) || '').trim().split(/\s+/)[0] || '';
    return f ? f.charAt(0).toUpperCase() + f.slice(1).toLowerCase() : 'cliente';
  }
  const hoursTxt = (h) => (Number(h) === 1 ? '1 hora' : `${String(h).replace('.', ',')} horas`);

  function chipsOf(reasons) {
    return (reasons || []).map((r) => {
      const [k, a, b] = String(r).split(':');
      switch (k) {
        case 'aniversario': return { t: a === '0' ? 'Aniversário hoje' : a === '1' ? 'Aniversário amanhã' : `Aniversário ${WEEKDAY_FULL[b] || b}`, c: 'gold' };
        case 'natal': return { t: 'Comprou no Natal', c: 'green' };
        case 'conjunto': return { t: 'Completar o conjunto', c: 'blue' };
        case 'sumida': return { t: 'Não volta há meses', c: 'orange' };
        case 'vip': return { t: 'Cliente VIP', c: 'purple' };
        case 'boa_cliente': return { t: 'Compra bem', c: 'purple' };
        case 'frequente': return { t: `${a} compras`, c: 'gray' };
        case 'manual': return { t: 'Adicionada pela busca', c: 'gray' };
        default: return null;
      }
    }).filter(Boolean);
  }
  const chipsHtml = (reasons) => {
    const list = chipsOf(reasons);
    return list.length ? `<div class="chips">${list.map((x) => `<span class="chip ${x.c}"><i></i>${esc(x.t)}</span>`).join('')}</div>` : '';
  };

  function statusInfo(c) {
    switch (c.status) {
      case 'pendente': return { t: 'Na fila', cls: '' };
      case 'enviada': return c.bump_sent_at ? { t: `Lembrete às ${time(c.bump_sent_at)}`, cls: 'warn' } : { t: `Enviada às ${time(c.sent_at)}`, cls: 'ok' };
      case 'respondeu': return { t: `Respondeu: ${REPLY_LABEL[c.reply_reason] || 'sim'}`, cls: 'ok' };
      case 'vendeu': return { t: `Comprou${c.sale_value ? ' · ' + money(c.sale_value) : ''}`, cls: 'ok' };
      case 'encerrada': {
        const r = String(c.close_reason || '');
        if (r.startsWith('pulada')) return { t: 'Pulada', cls: '' };
        const map = { parar: ['Não quer mais mensagens', 'bad'], agora_nao: ['Respondeu: agora não', ''], sem_resposta: ['Sem resposta', ''], expirou: ['Não enviada', ''], limite_follow_ups: ['Follow-ups encerrados', ''], encerrada: ['Conversa encerrada', ''] };
        const [t, cls] = map[r] || ['Encerrada', ''];
        return { t, cls };
      }
      default: return { t: c.status, cls: '' };
    }
  }

  // ------------------------------------------------------------------ API
  async function rpc(name, args) {
    if (DEMO) return Demo.rpc(name, args || {});
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw error;
    return data;
  }

  function allCycles() {
    const b = S.board || {};
    return [].concat(b.novos || [], b.lembretes || [], b.lembretes_feitos || [], b.followups || [], b.followups_feitos || []);
  }
  const cycleById = (id) => allCycles().find((c) => String(c.id) === String(id))
    || ((S.sheet && S.sheet.cycles) || []).find((c) => String(c.id) === String(id));

  function followMsg(c) {
    const n = (c.followups_done || 0);
    return FOLLOWUPS[n % FOLLOWUPS.length](fname(c.customer));
  }
  function defaultMsg(c, kind) {
    if (!c) return '';
    if (kind === 'lembrete') return c.bump_message;
    if (kind === 'follow') return followMsg(c);
    return c.message;
  }
  const getMsg = (id, kind) => S.edits[`${id}:${kind}`] ?? defaultMsg(cycleById(id), kind);

  function derive() {
    const b = S.board || {};
    const novos = b.novos || [];
    const pend = novos.filter((c) => c.status === 'pendente');
    const done = novos.filter((c) => c.status !== 'pendente')
      .sort((a, z) => String(z.updated_at || '').localeCompare(String(a.updated_at || '')));
    const now = Date.now();
    const lemb = b.lembretes || [];
    const lembDue = lemb.filter((c) => new Date(c.bump_due_at).getTime() <= now);
    const lembLater = lemb.filter((c) => new Date(c.bump_due_at).getTime() > now);
    const lembDone = b.lembretes_feitos || [];
    const fol = b.followups || [];
    const folDone = b.followups_feitos || [];
    const total = novos.length + lemb.length + lembDone.length + fol.length + folDone.length;
    const doneN = done.length + lembDone.length + folDone.length;
    return { novos, pend, done, lemb, lembDue, lembLater, lembDone, fol, folDone, total, doneN };
  }

  function pickCurrent(tab, list, pool) {
    const id = S.picked[tab];
    const all = pool || list;
    return (id && all.find((c) => String(c.id) === String(id))) || list[0] || null;
  }

  // ------------------------------------------------------------------ ações
  function openWa(phone, text) {
    const digits = String(phone || '').replace(/\D/g, '');
    copyText(text, true);
    if (DEMO) { toast('Modo demonstração: aqui o WhatsApp abriria com a mensagem pronta.'); return; }
    const a = document.createElement('a');
    a.href = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function copyText(text, silent) {
    const done = () => { if (!silent) toast('Mensagem copiada.'); };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
        return;
      }
    } catch (e) { /* segue para o plano B */ }
    fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* sem cópia */ }
    ta.remove();
  }

  function clearCard(id) {
    delete S.ui[id];
    Object.keys(S.edits).forEach((k) => { if (k.startsWith(`${id}:`)) delete S.edits[k]; });
    Object.keys(S.picked).forEach((t) => { if (String(S.picked[t]) === String(id)) delete S.picked[t]; });
  }

  async function act(fn, okText, undoId) {
    if (S.busy) return;
    S.busy = true;
    try {
      await fn();
      await loadBoard(true);
      if (S.sheet && S.sheet.code) await openCustomer(S.sheet.code, true);
      if (okText) toast(okText, undoId);
    } catch (e) {
      console.error(e);
      toast(errorText(e));
    } finally {
      S.busy = false;
      render();
    }
  }
  function errorText(e) {
    const m = String((e && (e.message || e.msg)) || '');
    if (m.includes('nao_quer_mensagens')) return 'Essa cliente pediu para não receber mais mensagens.';
    if (m.includes('sem_celular')) return 'Essa cliente não tem celular cadastrado.';
    if (m.includes('so_dona')) return 'Só a dona pode mudar isso.';
    return 'Não deu certo. Confira a internet e tente de novo.';
  }

  // ------------------------------------------------------------------ carregamento
  const pubUrl = (path) => `${CFG.supabaseUrl}/storage/v1/object/public/catalogo/${path}`;

  async function loadCatalog() {
    if (DEMO) { S.catalog = []; return; }
    try {
      const items = await rpc('catalog_list');
      const { data } = await sb.storage.from('catalogo').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      const loose = (data || []).filter((f) => f.id && f.name && !f.name.startsWith('.')).map((f) => ({
        name: f.name, url: pubUrl(f.name), type: (f.metadata && f.metadata.mimetype) || '', desc: '', loose: true,
      }));
      S.catalog = (items || []).filter((i) => i.image_path).map((i) => ({
        name: i.image_path, url: pubUrl(i.image_path), type: 'image/jpeg', desc: i.description || '', price: i.price, ref: i.ref,
      })).concat(loose);
    } catch (e) { console.error(e); S.catalog = []; }
    if (S.view === 'hoje' || S.view === 'resultados') render();
  }

  async function callIa(body) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(`${CFG.supabaseUrl}/functions/v1/ia`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: CFG.supabaseKey, authorization: `Bearer ${data.session && data.session.access_token}` },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  function setUpload(msg) {
    S.uploadMsg = msg;
    const el = document.getElementById('upload-status');
    if (el) el.textContent = msg; else render();
  }

  async function processCatalogPdf(file) {
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const week = new Date().toISOString().slice(0, 10);
    const items = [];
    const inflight = new Set();
    const upPhoto = async (path, blob, item) => {
      for (let t = 0; t < 3; t++) {
        const { error } = await sb.storage.from('catalogo').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
        if (!error) { items.push(item); return; }
        console.error(error);
      }
    };
    for (let i = 1; i <= pdf.numPages; i++) {
      setUpload(`Lendo página ${i} de ${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const text = (await page.getTextContent()).items.map((t) => t.str).join(' ');
      const ref = (text.match(/REF[:.\s]*([0-9A-Za-z.\-]+)/i) || [])[1];
      if (!ref) continue;
      const priceTxt = (text.match(/R\$\s*([0-9.]+,[0-9]{2})/) || [])[1];
      const vp = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
      const path = `semana-${week}/${ref}.jpg`;
      const item = { ref, page: i, price: priceTxt ? Number(priceTxt.replace(/\./g, '').replace(',', '.')) : null, image_path: path };
      // Upload in the background (up to 5 at once) while the next page renders.
      const job = upPhoto(path, blob, item).finally(() => inflight.delete(job));
      inflight.add(job);
      if (inflight.size >= 5) await Promise.race(inflight);
    }
    setUpload('Terminando de enviar as fotos...');
    await Promise.all(inflight);
    setUpload(`Salvando ${items.length} peças...`);
    items.sort((a, b) => a.page - b.page);
    const res = await rpc('catalog_replace', { p_week: week, p_items: items });
    setUpload('Apagando o catálogo antigo...');
    await wipeOldCatalog(new Set(items.map((x) => x.image_path)));
    if (res && res.sem_descricao) {
      setUpload(`A IA está olhando ${res.sem_descricao} fotos novas...`);
      await callIa({ action: 'describe' });
    }
    setUpload('Escrevendo as mensagens com as peças da semana...');
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
    const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);
    await callIa({ action: 'write', date: iso(d), force: true });
    await callIa({ action: 'write', date: iso(tomorrow), force: true });
    return items.length;
  }

  // Apaga do armazenamento tudo que não é do catálogo novo (pastas antigas e fotos soltas).
  async function wipeOldCatalog(keep) {
    try {
      const st = sb.storage.from('catalogo');
      const { data: top } = await st.list('', { limit: 1000 });
      const del = [];
      for (const f of top || []) {
        if (f.id) { if (!keep.has(f.name)) del.push(f.name); continue; }
        const { data: inner } = await st.list(f.name, { limit: 1000 });
        (inner || []).forEach((x) => { const pth = `${f.name}/${x.name}`; if (x.id && !keep.has(pth)) del.push(pth); });
      }
      for (let i = 0; i < del.length; i += 100) await st.remove(del.slice(i, i + 100));
    } catch (e) { console.error(e); }
  }

  async function uploadCatalog(files) {
    if (!files || !files.length || S.uploading) return;
    S.uploading = true; S.uploadMsg = 'Enviando...'; render();
    const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    files = files.filter((f) => !pdfs.includes(f));
    for (const pdf of pdfs) {
      try {
        const n = await processCatalogPdf(pdf);
        toast(`Catálogo pronto: ${n} peças. As mensagens já usam as peças da semana.`);
      } catch (e) { console.error(e); toast('Não consegui ler o PDF. Tente de novo.'); }
    }
    let ok = 0;
    for (const f of files) {
      const clean = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
      const { error } = await sb.storage.from('catalogo').upload(`${Date.now()}-${clean}`, f, { upsert: false, contentType: f.type || undefined });
      if (error) console.error(error); else ok++;
    }
    S.uploading = false; S.uploadMsg = '';
    await loadCatalog();
    await loadBoard(true); render();
    if (files.length) toast(ok === files.length ? `${ok} arquivo(s) no catálogo.` : `Subiram ${ok} de ${files.length}. Tente os outros de novo.`);
  }

  async function removeCatalog(name) {
    const { error } = await sb.storage.from('catalogo').remove([name]);
    if (error) { toast('Não deu para apagar. Tente de novo.'); return; }
    await loadCatalog();
    toast('Arquivo apagado do catálogo.');
  }

  async function openCatalog() {
    S.catalogOpen = true;
    renderSheet();
    S.catalog.slice(0, 40).forEach((f) => prefetchBlob(f.name, f.url));
  }

  function shareCatalog(name) {
    const file = S.catalogBlobs[name];
    const item = S.catalog.find((x) => x.name === name) || { url: pubUrl(name) };
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => {});
      return;
    }
    if (item) window.open(item.url, '_blank');
  }

  async function loadBoard(silent) {
    try {
      S.board = await rpc('today_board');
      S.phase = 'app';
      loadCatalog();
    } catch (e) {
      console.error(e);
      if (String(e.message || '').includes('sem_permissao') && !DEMO) {
        await sb.auth.signOut();
        S.phase = 'login';
        S.login.error = 'Este login não tem acesso. Fale com a dona.';
      } else if (!silent) {
        toast(errorText(e));
      }
    }
    if (!silent) render();
  }

  async function openCustomer(code, quiet) {
    if (!quiet) { S.sheet = { code, loading: true }; renderSheet(); }
    try {
      const data = await rpc('customer_detail', { p_code: code });
      S.sheet = Object.assign({ code }, data || {});
    } catch (e) {
      console.error(e);
      S.sheet = null;
      toast(errorText(e));
    }
    renderSheet();
  }

  async function loadResults() {
    S.results = null;
    render();
    try { S.results = await rpc('results_summary', { p_days: 7 }); } catch (e) { console.error(e); toast(errorText(e)); }
    render();
  }

  let searchTimer = null;
  function onSearch(q) {
    S.search.q = q;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      if (q.trim().length < 2) { S.search.results = null; renderSearchResults(); return; }
      S.search.loading = true;
      renderSearchResults();
      try { S.search.results = await rpc('search_customers', { p_q: q }); } catch (e) { console.error(e); S.search.results = []; }
      S.search.loading = false;
      renderSearchResults();
    }, 300);
  }

  // ------------------------------------------------------------------ pedaços de tela
  function cardHead(c, label) {
    const cu = c.customer || {};
    return `<div class="card-head">
      <span class="rank">${esc(label)}</span>
      <div class="who"><span class="name">${esc(cu.name || '')}</span><span class="small muted">${esc(phoneFmt(cu.phone))}</span></div>
      <button class="link-btn" data-act="customer" data-code="${esc(cu.code)}">Ver ficha</button>
    </div>`;
  }
  function lastBuy(cu) {
    const items = (cu.last_items || []).slice(0, 2).map(itemTxt).filter(Boolean);
    if (!items.length && !cu.last_period) return '';
    return `<p class="small muted"><b class="strong" style="color:var(--ink)">Última compra${cu.last_period ? ' (' + esc(period(cu.last_period)) + ')' : ''}:</b> ${esc(items.join(', ') || 'sem detalhes')}</p>`;
  }
  function msgBox(c, kind, label) {
    const key = `${c.id}:${kind}`;
    return `<div class="msg-box"><span class="msg-label">${esc(label)}</span>
      <textarea class="msg" data-edit="${key}" rows="${Math.min(12, Math.max(4, Math.ceil(String(getMsg(c.id, kind) || '').length / 32) + 1))}" aria-label="${esc(label)}">${esc(getMsg(c.id, kind))}</textarea></div>`;
  }
  function waButtons(c, kind, label) {
    return `<div class="btns">
      <button class="btn primary" data-act="wa" data-id="${c.id}" data-kind="${kind}">${I.wa} ${esc(label || 'Abrir no WhatsApp')}</button>
      <button class="btn" data-act="copy" data-id="${c.id}" data-kind="${kind}">${I.copy} Copiar mensagem</button>
    </div>`;
  }
  function confirmBlock(c, kind, question) {
    return `<p class="ask">${esc(question)}</p>
      <div class="btns">
        <button class="btn primary" data-act="sent" data-id="${c.id}" data-kind="${kind}">${I.check} Sim, enviei</button>
        <button class="btn" data-act="wa" data-id="${c.id}" data-kind="${kind}">Abrir o WhatsApp de novo</button>
        <button class="link-btn" data-act="back" data-id="${c.id}" style="align-self:flex-start">Voltar</button>
      </div>`;
  }
  function replyBlock(c) {
    return `<p class="ask">O que ${esc(fname(c.customer))} respondeu?</p>
      <div class="pills">${REPLY.map((r) => `<button class="pill ${r.danger ? 'danger' : ''}" data-act="reply" data-id="${c.id}" data-r="${r.k}">${esc(r.label)}</button>`).join('')}</div>
      <button class="link-btn" data-act="back" data-id="${c.id}" style="align-self:flex-start">Voltar</button>`;
  }
  function soldBlock(c) {
    return `<p class="ask">${esc(fname(c.customer))} comprou!</p>
      <label class="field">Valor da compra (se souber)<input class="input" inputmode="decimal" placeholder="Ex.: 189,90" data-sold-value="${c.id}"></label>
      <div class="btns">
        <button class="btn primary" data-act="sold-save" data-id="${c.id}">${I.check} Salvar venda</button>
        <button class="link-btn" data-act="back" data-id="${c.id}" style="align-self:flex-start">Voltar</button>
      </div>`;
  }

  function itemBlock(c) {
    const it = c.item;
    if (!it || !it.image_path) return '';
    const url = pubUrl(it.image_path);
    prefetchBlob(it.image_path, url);
    return `<div class="msg-box" style="flex-direction:row;align-items:center;gap:12px">
      <img src="${esc(url)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0">
      <div style="flex:1;min-width:0"><span class="msg-label">Peça sugerida</span><p class="small">${esc((it.description || '').toLowerCase())}</p></div>
    </div>
    <button class="btn" data-act="catalog-share" data-name="${esc(it.image_path)}">📸 Enviar foto da peça</button>`;
  }

  async function prefetchBlob(name, url) {
    if (S.catalogBlobs[name] || S.catalogBlobs[`loading:${name}`]) return;
    S.catalogBlobs[`loading:${name}`] = true;
    try {
      const b = await (await fetch(url)).blob();
      S.catalogBlobs[name] = new File([b], name.split('/').pop(), { type: b.type || 'image/jpeg' });
    } catch (e) { /* abre pelo link */ }
  }

  function cardNovo(c) {
    const u = S.ui[c.id] || {};
    const cu = c.customer || {};
    const head = cardHead(c, `#${c.position ?? ''}`);
    if (u.step === 'confirm') return `<article class="card">${head}${confirmBlock(c, 'novo', `Enviou a mensagem para ${fname(cu)}?`)}</article>`;
    if (u.step === 'skip') {
      return `<article class="card">${head}<p class="ask">Por que pular?</p>
        <div class="pills">${SKIP.map((r) => `<button class="pill" data-act="skip-do" data-id="${c.id}" data-r="${r.k}">${esc(r.label)}</button>`).join('')}</div>
        <button class="link-btn" data-act="back" data-id="${c.id}" style="align-self:flex-start">Voltar</button></article>`;
    }
    return `<article class="card">${head}${chipsHtml(c.reasons)}${lastBuy(cu)}${itemBlock(c)}
      ${msgBox(c, 'novo', 'Mensagem pronta')}${waButtons(c, 'novo')}
      <button class="link-btn" data-act="skip" data-id="${c.id}" style="align-self:flex-start">Pular esta</button></article>`;
  }

  function cardLembrete(c) {
    const u = S.ui[c.id] || {};
    const cu = c.customer || {};
    const head = cardHead(c, '↺');
    if (u.step === 'reply') return `<article class="card">${head}${replyBlock(c)}</article>`;
    if (u.step === 'confirm') return `<article class="card">${head}${confirmBlock(c, 'lembrete', `Enviou o lembrete para ${fname(cu)}?`)}</article>`;
    if (u.step === 'bump') {
      return `<article class="card">${head}${msgBox(c, 'lembrete', 'Lembrete pronto')}${waButtons(c, 'lembrete')}
        <button class="link-btn" data-act="back" data-id="${c.id}" style="align-self:flex-start">Voltar</button></article>`;
    }
    return `<article class="card">${head}
      <p class="small muted">Primeira mensagem às ${esc(time(c.sent_at))}</p>
      <p class="ask">${esc(fname(cu))} respondeu no WhatsApp?</p>
      <div class="btns">
        <button class="btn primary" data-act="bump-no" data-id="${c.id}">Não, mandar lembrete</button>
        <button class="btn" data-act="reply-ask" data-id="${c.id}">Sim, respondeu</button>
      </div></article>`;
  }

  function cardFollow(c) {
    const u = S.ui[c.id] || {};
    const cu = c.customer || {};
    const max = (S.board && S.board.settings && S.board.settings.followup_max) || 12;
    const head = cardHead(c, `${(c.followups_done || 0) + 1}/${max}`);
    if (u.step === 'confirm') return `<article class="card">${head}${confirmBlock(c, 'follow', `Enviou a mensagem para ${fname(cu)}?`)}</article>`;
    if (u.step === 'sold') return `<article class="card">${head}${soldBlock(c)}</article>`;
    return `<article class="card">${head}
      <div class="chips"><span class="chip green"><i></i>Respondeu: ${esc(REPLY_LABEL[c.reply_reason] || 'sim')}</span><span class="chip gray"><i></i>Follow-up ${(c.followups_done || 0) + 1} de ${max}</span></div>
      ${lastBuy(cu)}${msgBox(c, 'follow', 'Mensagem sugerida (pode mudar)')}${waButtons(c, 'follow')}
      <div class="pills">
        <button class="pill good" data-act="sold-ask" data-id="${c.id}">Comprou</button>
        <button class="pill" data-act="close" data-id="${c.id}">Encerrar conversa</button>
        <button class="pill danger" data-act="stop" data-id="${c.id}" data-code="${esc(cu.code)}">Não quer mais</button>
      </div></article>`;
  }

  function rowNext(c, tab, extraRight) {
    const cu = c.customer || {};
    const chip = chipsOf(c.reasons)[0];
    return `<button class="row" data-act="pick" data-tab="${tab}" data-id="${c.id}">
      <span class="rank">${tab === 'novos' ? esc(c.position ?? '') : tab === 'lembretes' ? '↺' : esc(`${(c.followups_done || 0) + 1}ª`)}</span>
      <span class="grow"><span class="row-name">${esc(cu.name || '')}</span><span class="small muted">${esc(extraRight || (chip ? chip.t : phoneFmt(cu.phone)))}</span></span>
    </button>`;
  }

  function rowDone(c) {
    const cu = c.customer || {};
    const st = statusInfo(c);
    const u = S.ui[c.id] || {};
    const canReply = c.status === 'enviada';
    const canSell = c.status === 'enviada' || c.status === 'respondeu';
    let extra = '';
    if (u.step === 'reply') extra = `<div class="row-extra">${replyBlock(c)}</div>`;
    if (u.step === 'sold') extra = `<div class="row-extra">${soldBlock(c)}</div>`;
    return `<div>
      <div class="row">
        <div class="grow"><span class="row-name">${esc(cu.name || '')}</span><span class="small"><span class="status ${st.cls}">${esc(st.t)}</span></span></div>
        <div class="row-actions">
          ${canReply ? `<button class="link-btn" data-act="reply-ask" data-id="${c.id}">Respondeu</button>` : ''}
          ${!canReply && canSell ? `<button class="link-btn" data-act="sold-ask" data-id="${c.id}">Comprou</button>` : ''}
          <button class="link-btn" data-act="undo" data-id="${c.id}">Desfazer</button>
        </div>
      </div>${extra}</div>`;
  }

  // ------------------------------------------------------------------ telas
  function renderHeader() {
    const d = derive();
    const b = S.board || {};
    const pct = d.total ? Math.round((d.doneN / d.total) * 100) : 0;
    const roleTxt = b.role === 'dona' ? 'Dona' : 'Celular da loja';
    const camp = b.settings && b.settings.campaign_line;
    return `<header class="top">
      ${DEMO ? '<div class="banner demo"><span><b>Modo demonstração.</b> Clientes e números são de exemplo.</span></div>' : ''}
      <div class="top-row">
        <div><div class="eyebrow">${esc(dateLong(b.date))}</div><h1 class="title">Lista de hoje</h1></div>
        <span class="badge">${I.phone}${esc(roleTxt)}</span>
      </div>
      <div class="progress">
        <div class="progress-row"><span class="strong">Feitos hoje</span><span class="small muted">${d.doneN} de ${d.total}</span></div>
        <div class="bar"><span style="width:${pct}%"></span></div>
      </div>
      ${camp ? `<div class="banner"><span>${I.gift}</span><span><b>Campanha:</b> ${esc(camp)}</span></div>` : ''}
      ${S.catalog.length ? `<button class="btn" data-act="catalog">📸 Catálogo da semana (${S.catalog.length})</button>` : ''}
      <div class="tabs" role="tablist">
        ${tabBtn('novos', 'Novos', d.pend.length)}
        ${tabBtn('lembretes', 'Lembretes', d.lembDue.length)}
        ${tabBtn('followups', 'Follow-ups', d.fol.length)}
      </div>
    </header>`;
  }
  const tabBtn = (k, label, n) => `<button class="tab" role="tab" aria-selected="${S.tab === k}" data-act="tab" data-tab="${k}">${label}<span class="count">${n}</span></button>`;

  function renderNovos(d) {
    const b = S.board || {};
    if (!d.novos.length) {
      return `<div class="card empty"><div class="big">A lista de hoje ainda não saiu</div>
        <div>Ela aparece aqui todo dia às 7h da manhã.</div>
        ${b.role === 'dona' || DEMO ? (S.generating ? `<button class="btn primary" disabled aria-busy="true"><span class="spinner" aria-hidden="true"></span> ${esc(S.generating)}</button>` : '<button class="btn primary" data-act="generate">Gerar a lista agora</button>') : ''}</div>`;
    }
    let html = '';
    if (d.pend.length) {
      const cur = pickCurrent('novos', d.pend);
      html += `<section class="section"><h2 class="section-title">Agora</h2>${cardNovo(cur)}</section>`;
      const rest = d.pend.filter((c) => c.id !== cur.id);
      if (rest.length) {
        html += `<section class="section"><h2 class="section-title">A seguir <span class="small muted">${rest.length}</span></h2>
          <div class="list">${rest.slice(0, S.nextShown).map((c) => rowNext(c, 'novos')).join('')}</div>
          ${rest.length > S.nextShown ? `<button class="btn" data-act="more">Mostrar mais ${Math.min(10, rest.length - S.nextShown)}</button>` : ''}</section>`;
      }
    } else {
      html += `<div class="card empty"><div class="big">Mensagens novas de hoje: todas feitas</div><div>Os lembretes aparecem na aba Lembretes ao longo do dia.</div></div>`;
    }
    if (d.done.length) {
      html += `<section class="section"><h2 class="section-title">Feitos hoje <span class="small muted">${d.done.length}</span></h2>
        <div class="list">${d.done.map(rowDone).join('')}</div></section>`;
    }
    return html;
  }

  function renderLembretes(d) {
    const s = (S.board && S.board.settings) || {};
    let html = `<p class="small muted">Para quem ainda não respondeu, ${esc(hoursTxt(s.bump_hours ?? 4))} depois da primeira mensagem. Antes de mandar, confira se a pessoa já respondeu.</p>`;
    const pool = d.lembDue.concat(d.lembLater);
    const pickedLater = S.picked.lembretes && d.lembLater.find((c) => String(c.id) === String(S.picked.lembretes));
    if (d.lembDue.length || pickedLater) {
      const cur = pickCurrent('lembretes', d.lembDue, pool);
      html += `<section class="section"><h2 class="section-title">Agora</h2>${cardLembrete(cur)}</section>`;
      const rest = d.lembDue.filter((c) => c.id !== cur.id);
      if (rest.length) html += `<section class="section"><h2 class="section-title">Também na hora <span class="small muted">${rest.length}</span></h2><div class="list">${rest.map((c) => rowNext(c, 'lembretes', `Enviada às ${time(c.sent_at)}`)).join('')}</div></section>`;
    } else if (d.lembLater.length) {
      html += `<div class="card empty"><div class="big">Nenhum lembrete agora</div><div>O próximo é às ${esc(time(d.lembLater[0].bump_due_at))}.</div></div>`;
    } else if (!d.lembDone.length) {
      html += `<div class="card empty"><div class="big">Sem lembretes por enquanto</div><div>Eles aparecem aqui depois que as mensagens novas forem enviadas.</div></div>`;
    }
    const later = d.lembLater.filter((c) => !pickedLater || c.id !== pickedLater.id);
    if (later.length) {
      html += `<section class="section"><h2 class="section-title">Mais tarde <span class="small muted">${later.length}</span></h2>
        <div class="list">${later.map((c) => rowNext(c, 'lembretes', `Lembrete às ${time(c.bump_due_at)} · toque para mandar agora`)).join('')}</div></section>`;
    }
    if (d.lembDone.length) {
      html += `<section class="section"><h2 class="section-title">Lembretes enviados <span class="small muted">${d.lembDone.length}</span></h2>
        <div class="list">${d.lembDone.map(rowDone).join('')}</div></section>`;
    }
    return html;
  }

  function renderFollow(d) {
    const s = (S.board && S.board.settings) || {};
    let html = `<p class="small muted">Quem respondeu recebe uma mensagem a cada ${esc(s.followup_every_days ?? 2)} dias, até ${esc(s.followup_max ?? 12)} vezes, até comprar ou encerrar.</p>`;
    if (d.fol.length) {
      const cur = pickCurrent('followups', d.fol);
      html += `<section class="section"><h2 class="section-title">Agora</h2>${cardFollow(cur)}</section>`;
      const rest = d.fol.filter((c) => c.id !== cur.id);
      if (rest.length) html += `<section class="section"><h2 class="section-title">A seguir <span class="small muted">${rest.length}</span></h2><div class="list">${rest.map((c) => rowNext(c, 'followups', `Respondeu: ${REPLY_LABEL[c.reply_reason] || 'sim'}`)).join('')}</div></section>`;
    } else {
      html += `<div class="card empty"><div class="big">Nenhum follow-up para hoje</div><div>${(S.board && S.board.conversando) ? `${S.board.conversando} conversa(s) em andamento. Elas voltam aqui no dia certo.` : 'Quando alguém responder, a conversa aparece aqui.'}</div></div>`;
    }
    if (d.folDone.length) {
      html += `<section class="section"><h2 class="section-title">Follow-ups enviados hoje <span class="small muted">${d.folDone.length}</span></h2>
        <div class="list">${d.folDone.map(rowDone).join('')}</div></section>`;
    }
    return html;
  }

  function renderClientes() {
    return `<header class="top"><h1 class="title">Clientes</h1>
      <label class="search">${I.search}<input id="search-input" type="search" placeholder="Nome ou telefone" autocomplete="off" value="${esc(S.search.q)}" aria-label="Buscar cliente"></label>
    </header><main><div id="search-results">${searchResultsHtml()}</div></main>`;
  }
  function searchResultsHtml() {
    if (S.search.loading) return '<div class="center"><div class="spin"></div></div>';
    const r = S.search.results;
    if (!r) return '<p class="small muted">Busque pelo nome ou pelo celular. Toque na cliente para ver a ficha, marcar que respondeu ou que comprou.</p>';
    if (!r.length) return '<div class="empty"><div class="big">Ninguém encontrado</div><div>Tente só o primeiro nome ou os últimos números do celular.</div></div>';
    return `<div class="list">${r.map((c) => {
      const st = c.last_cycle ? statusInfo({ status: c.last_cycle.status, close_reason: c.last_cycle.close_reason }) : null;
      if (st && c.last_cycle.status === 'enviada') st.t = 'Enviada';
      return `<button class="row" data-act="customer" data-code="${esc(c.code)}">
        <span class="grow"><span class="row-name">${esc(c.name)}</span><span class="small muted">${esc(phoneFmt(c.phone))}${c.cidade ? ' · ' + esc(c.cidade) : ''}</span></span>
        ${c.do_not_contact ? '<span class="status bad">Não quer</span>' : st ? `<span class="status ${st.cls}">${esc(st.t.split(':')[0])}</span>` : ''}
      </button>`;
    }).join('')}</div>`;
  }
  function renderSearchResults() {
    const el = document.getElementById('search-results');
    if (el) el.innerHTML = searchResultsHtml();
  }

  function renderResultados() {
    const r = S.results;
    const role = S.board && S.board.role;
    let html = `<header class="top"><div class="top-row"><h1 class="title">Resultados</h1><button class="link-btn" data-act="results-refresh">Atualizar</button></div></header><main>`;
    if (!r) return html + '<div class="center"><div class="spin"></div></div></main>';
    const t = (r.dias && r.dias[0]) || {};
    const a = r.agora || {};
    const wk = (r.dias || []).reduce((acc, x) => {
      ['enviadas', 'respostas', 'vendas', 'valor'].forEach((k) => { acc[k] = (acc[k] || 0) + Number(x[k] || 0); });
      return acc;
    }, {});
    html += `<section class="section"><h2 class="section-title">Hoje</h2><div class="grid2">
      ${stat('Mensagens novas', t.enviadas)}${stat('Lembretes', t.lembretes)}
      ${stat('Responderam', t.respostas)}${stat('Venderam', t.vendas, t.valor ? money(t.valor) : '')}
    </div></section>
    <section class="section"><h2 class="section-title">Últimos 7 dias</h2><div class="grid2">
      ${stat('Enviadas', wk.enviadas)}${stat('Responderam', wk.respostas, wk.enviadas ? Math.round((wk.respostas / wk.enviadas) * 100) + '% das enviadas' : '')}
      ${stat('Vendas', wk.vendas)}${stat('Valor vendido', null, money(wk.valor))}
    </div>
    <div class="list"><table class="days"><thead><tr><th>Dia</th><th>Env.</th><th>Lemb.</th><th>Resp.</th><th>Vendas</th></tr></thead><tbody>
      ${(r.dias || []).map((x) => `<tr><td>${esc(dateShort(x.d))}</td><td>${x.enviadas}</td><td>${x.lembretes}</td><td>${x.respostas}</td><td>${x.vendas}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="section"><h2 class="section-title">Agora</h2><div class="grid2">
      ${stat('Em conversa', a.conversando)}${stat('Esperando resposta', a.aguardando)}
      ${stat('Vendas no total', a.vendas, a.valor ? money(a.valor) : '')}${stat('Não querem mais', a.nao_querem)}
    </div><p class="small muted">${esc(Number(a.clientes_com_whatsapp || 0).toLocaleString('pt-BR'))} clientes com WhatsApp na base.</p></section>`;
    if (role === 'dona') html += renderCatalogAdmin() + renderSettings();
    html += `<button class="btn" data-act="logout">${DEMO ? 'Sair do modo demonstração' : 'Sair desta conta'}</button></main>`;
    return html;
  }
  const stat = (label, n, sub) => `<div class="stat"><span class="small muted">${esc(label)}</span><span class="num">${n === null || n === undefined ? '' : esc(n)}</span>${sub ? `<span class="small muted">${esc(sub)}</span>` : ''}</div>`;

  function renderCatalogAdmin() {
    const items = S.catalog.map((f) => `<div class="row" style="min-height:56px">
        ${/^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name) ? `<img src="${esc(f.url)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px">` : '<span class="rank">PDF</span>'}
        <span class="grow small">${esc(f.desc || f.name.replace(/^\d+-/, ''))}</span>
        <button class="link-btn danger" data-act="catalog-del" data-name="${esc(f.name)}">Apagar</button></div>`).join('');
    return `<section class="section"><h2 class="section-title">Catálogo da semana</h2>
      <div class="card">
        <p class="small muted">Suba aqui o PDF do catálogo da semana. O catálogo novo substitui o antigo inteiro. O app separa uma foto por peça e reescreve as mensagens de hoje e de amanhã com as peças novas.</p>
        <label class="btn primary" style="cursor:pointer">${S.uploading ? 'Enviando...' : '📸 Adicionar fotos ou PDF'}
          <input type="file" id="catalog-input" accept="image/*,application/pdf,video/mp4" multiple hidden ${S.uploading ? 'disabled' : ''}></label>
        <p class="small strong" id="upload-status">${esc(S.uploading ? (S.uploadMsg || '') : '')}</p>
        ${S.catalog.some((f) => f.ref) ? `<button class="btn" data-act="ia-rewrite">✨ Reescrever as mensagens de hoje com o catálogo</button>` : ''}
        ${!items ? '<p class="small muted">Nenhum arquivo ainda.</p>'
          : `<p class="small strong">${S.catalog.length} peças no catálogo atual.</p>
             <button class="btn" data-act="catalog-toggle">${S.catalogListOpen ? 'Esconder as fotos' : 'Ver as fotos'}</button>
             ${S.catalogListOpen ? `<div class="list" style="max-height:420px;overflow:auto">${items}</div>` : ''}`}
      </div></section>`;
  }

  function renderSettings() {
    const s = (S.board && S.board.settings) || {};
    const num = (k, label, min, max, step) => `<label class="field">${esc(label)}<input class="input" type="number" inputmode="decimal" name="${k}" min="${min}" max="${max}" step="${step || 1}" value="${esc(s[k])}"></label>`;
    return `<section class="section"><h2 class="section-title">Ajustes da dona</h2>
      <form id="settings-form" class="card">
        <label class="field">Frase da campanha (entra nas mensagens novas)
          <textarea class="input" name="campaign_line" placeholder="Ex.: Até o dia 24 a embalagem de presente é por nossa conta.">${esc(s.campaign_line || '')}</textarea>
        </label>
        <p class="small muted">Deixe em branco quando não houver campanha. Vale a partir da próxima lista.</p>
        <div class="grid2">
          ${num('daily_new', 'Novos por dia', 0, 300)}
          ${num('bump_hours', 'Lembrete depois de (horas)', 0, 12, 0.5)}
          ${num('followup_every_days', 'Follow-up a cada (dias)', 1, 30)}
          ${num('followup_max', 'Máximo de follow-ups', 0, 50)}
        </div>
        ${num('rest_days', 'Dias até poder chamar a mesma cliente de novo', 7, 365)}
        <button class="btn primary" type="submit">Salvar ajustes</button>
      </form></section>`;
  }

  function renderNav() {
    const item = (k, label, icon) => `<button data-act="nav" data-view="${k}" aria-current="${S.view === k ? 'page' : 'false'}">${icon}<span>${label}</span></button>`;
    return `<nav class="nav"><div class="nav-inner">${item('hoje', 'Hoje', I.today)}${item('clientes', 'Clientes', I.people)}${item('resultados', 'Resultados', I.chart)}</div></nav>`;
  }

  function renderLogin() {
    const L = S.login;
    return `<div class="login">
      <div class="logo">${I.gift}</div>
      <div><h1 class="title">Lista do dia</h1><p class="muted">Baummer Nações</p></div>
      <div class="seg" role="group" aria-label="Quem está entrando">
        <button type="button" aria-pressed="${L.role === 'loja'}" data-act="login-role" data-r="loja">Loja</button>
        <button type="button" aria-pressed="${L.role === 'dona'}" data-act="login-role" data-r="dona">Dona</button>
      </div>
      <form id="login-form" class="section" method="post" action="#">
        <input class="sr-only" type="email" name="username" autocomplete="username" value="${esc((CFG.users || {})[L.role] || '')}" readonly tabindex="-1" aria-hidden="true">
        <label class="field">Senha<input class="input" type="password" name="password" autocomplete="current-password" required></label>
        ${L.error ? `<p class="error">${esc(L.error)}</p>` : ''}
        <button class="btn primary" type="submit" ${L.loading ? 'disabled' : ''}>${L.loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>`;
  }

  function renderCatalogSheet() {
    const items = S.catalog.map((f) => {
      const isImg = /^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
      return `<div class="card" style="gap:10px">
        ${isImg ? `<img src="${esc(f.url)}" alt="" loading="lazy" style="width:100%;border-radius:10px">` : ''}
        ${f.desc ? `<p class="small">${esc(f.desc.toLowerCase())}</p>` : (isImg ? '' : `<p class="strong">${esc(f.name.replace(/^\d+-/, ''))}</p>`)}
        <button class="btn primary" data-act="catalog-share" data-name="${esc(f.name)}">${I.wa} Enviar no WhatsApp</button></div>`;
    }).join('');
    return `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" data-stop role="dialog" aria-label="Catálogo da semana">
      <div class="top-row"><h2 class="title">Catálogo da semana</h2><button class="link-btn" data-act="sheet-close">Fechar</button></div>
      <p class="small muted">Toque em Enviar, escolha o WhatsApp e a conversa da cliente.</p>${items}</div></div>`;
  }

  function renderSheetHtml() {
    if (S.catalogOpen) return renderCatalogSheet();
    const c = S.sheet;
    if (!c) return '';
    if (c.loading) return `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" data-stop><div class="center"><div class="spin"></div></div></div></div>`;
    const cycles = c.cycles || [];
    const last = cycles[0];
    const u = last ? (S.ui[last.id] || {}) : {};
    const canReply = last && (last.status === 'enviada' || (last.status === 'encerrada' && last.close_reason === 'sem_resposta'));
    const canSell = last && (last.status === 'enviada' || last.status === 'respondeu');
    const canAdd = (!last || ['encerrada', 'vendeu'].includes(last.status)) && !c.do_not_contact && c.phone;
    const store = (S.board && S.board.settings && S.board.settings.store_name) || 'Baummer Nações';
    const info = [
      ['Celular', phoneFmt(c.phone)],
      ['Cidade', [c.bairro, c.cidade].filter(Boolean).join(', ')],
      ['Aniversário', c.birth_date ? dateShort(c.birth_date) : ''],
      ['Total gasto', c.total_spent ? money(c.total_spent) : ''],
      ['Última compra', period(c.last_period)],
      ['Cliente desde', c.customer_since ? String(c.customer_since).slice(0, 4) : ''],
      ['Vendedor(a)', c.seller || ''],
    ].filter((x) => x[1]);
    let actions = '';
    if (c.phone && !c.do_not_contact) actions += `<button class="btn" data-act="wa-free" data-phone="${esc(c.phone)}" data-text="${esc(`Oi ${fname(c)}, tudo bem? Aqui é da ${store}.`)}">${I.wa} Abrir conversa no WhatsApp</button>`;
    if (canReply && u.step !== 'reply') actions += `<button class="btn primary" data-act="reply-ask" data-id="${last.id}">Marcar que respondeu</button>`;
    if (canSell && u.step !== 'sold') actions += `<button class="btn" data-act="sold-ask" data-id="${last.id}">Comprou</button>`;
    if (canAdd) actions += `<button class="btn" data-act="manual" data-code="${esc(c.code)}">Colocar na lista de hoje</button>`;
    if (!c.do_not_contact) actions += `<button class="btn danger" data-act="stop" data-code="${esc(c.code)}" ${last && !['encerrada', 'vendeu'].includes(last.status) ? `data-id="${last.id}"` : ''}>Não quer mais mensagens</button>`;
    let extra = '';
    if (last && u.step === 'reply') extra = `<div class="card">${replyBlock(Object.assign({}, last, { customer: c }))}</div>`;
    if (last && u.step === 'sold') extra = `<div class="card">${soldBlock(Object.assign({}, last, { customer: c }))}</div>`;
    return `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" data-stop role="dialog" aria-label="Ficha da cliente">
      <div class="top-row"><div><h2 class="title">${esc(c.name)}</h2>${c.do_not_contact ? '<span class="status bad">Não quer mais mensagens</span>' : ''}</div>
        <button class="link-btn" data-act="sheet-close">Fechar</button></div>
      <div class="list">${info.map(([k, v]) => `<div class="row" style="min-height:48px"><span class="grow small muted">${esc(k)}</span><span class="strong">${esc(v)}</span></div>`).join('')}</div>
      ${extra}
      <div class="btns">${actions}</div>
      ${cycles.length ? `<section class="section"><h3 class="section-title">Histórico de mensagens</h3><div class="list">${cycles.map((y) => {
        const st = statusInfo(y);
        return `<div class="row"><span class="grow"><span class="strong">${esc(dateShort(y.list_date))}</span><span class="small muted">${esc(chipsOf(y.reasons).map((x) => x.t).join(' · '))}</span></span><span class="status ${st.cls}">${esc(st.t)}</span></div>`;
      }).join('')}</div></section>` : ''}
      ${(c.purchases || []).length ? `<section class="section"><h3 class="section-title">Compras</h3><div class="list">${c.purchases.map((p) => `<div class="row"><span class="grow"><span>${esc(itemTxt(p.description))}</span><span class="small muted">${esc(period(p.period))}</span></span><span class="strong">${esc(money(p.paid))}</span></div>`).join('')}</div></section>` : ''}
    </div></div>`;
  }
  function renderSheet() {
    const root = document.getElementById('sheet-root');
    if (root) root.innerHTML = renderSheetHtml();
  }

  // ------------------------------------------------------------------ toast
  let toastTimer = null;
  function toast(text, undoId) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    root.innerHTML = `<div class="toast" role="status"><span>${esc(text)}</span>${undoId ? `<button data-act="undo" data-id="${undoId}" data-toast="1">Desfazer</button>` : ''}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, undoId ? 7000 : 3500);
  }

  // ------------------------------------------------------------------ render
  function render() {
    const root = document.getElementById('app');
    if (S.phase === 'loading') { root.innerHTML = '<div class="center"><div class="spin"></div></div>'; return; }
    if (S.phase === 'login') { root.innerHTML = renderLogin(); return; }
    let html = '';
    if (S.view === 'hoje') {
      const d = derive();
      const body = S.tab === 'novos' ? renderNovos(d) : S.tab === 'lembretes' ? renderLembretes(d) : renderFollow(d);
      html = renderHeader() + `<main>${body}</main>`;
    } else if (S.view === 'clientes') {
      html = renderClientes();
    } else {
      html = renderResultados();
    }
    root.innerHTML = html + renderNav();
    renderSheet();
  }

  // ------------------------------------------------------------------ eventos
  const handlers = {
    tab: (ds) => { S.tab = ds.tab; render(); window.scrollTo(0, 0); },
    nav: (ds) => {
      S.view = ds.view;
      if (S.view === 'resultados') loadResults();
      else render();
      window.scrollTo(0, 0);
      if (S.view === 'clientes') setTimeout(() => { const i = document.getElementById('search-input'); if (i && !S.search.q) i.focus(); }, 50);
    },
    pick: (ds) => { S.picked[ds.tab] = ds.id; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    more: () => { S.nextShown += 10; render(); },
    back: (ds) => { delete S.ui[ds.id]; render(); renderSheet(); },
    wa: (ds) => {
      const c = cycleById(ds.id);
      if (!c) return;
      openWa(c.customer && c.customer.phone, getMsg(ds.id, ds.kind));
      S.ui[ds.id] = { step: 'confirm' };
      render();
    },
    copy: (ds) => copyText(getMsg(ds.id, ds.kind)),
    'wa-free': (ds) => openWa(ds.phone, ds.text),
    sent: (ds) => {
      const c = cycleById(ds.id);
      const name = fname(c && c.customer);
      const msg = getMsg(ds.id, ds.kind);
      const fn = ds.kind === 'lembrete' ? () => rpc('mark_bump_sent', { p_id: Number(ds.id) })
        : ds.kind === 'follow' ? () => rpc('mark_followup_sent', { p_id: Number(ds.id), p_message: msg })
          : () => rpc('mark_sent', { p_id: Number(ds.id), p_message: msg });
      clearCard(ds.id);
      act(fn, ds.kind === 'lembrete' ? `Lembrete enviado para ${name}.` : `Mensagem enviada para ${name}.`, ds.id);
    },
    skip: (ds) => { S.ui[ds.id] = { step: 'skip' }; render(); },
    'skip-do': (ds) => { clearCard(ds.id); act(() => rpc('close_cycle', { p_id: Number(ds.id), p_reason: `pulada:${ds.r}` }), 'Pulada.', ds.id); },
    'bump-no': (ds) => { S.ui[ds.id] = { step: 'bump' }; render(); },
    'reply-ask': (ds) => { S.ui[ds.id] = { step: 'reply' }; render(); },
    reply: (ds) => {
      const c = cycleById(ds.id);
      const name = fname(c && c.customer);
      clearCard(ds.id);
      const txt = ds.r === 'nao_quer' ? `${name} não recebe mais mensagens.` : ds.r === 'agora_nao' ? `Anotado: ${name} disse que agora não.` : `${name} foi para os follow-ups.`;
      act(() => rpc('mark_replied', { p_id: Number(ds.id), p_reason: ds.r }), txt, ds.id);
    },
    'sold-ask': (ds) => { S.ui[ds.id] = { step: 'sold' }; render(); },
    'sold-save': (ds) => {
      const input = document.querySelector(`[data-sold-value="${ds.id}"]`);
      const raw = input ? input.value.trim() : '';
      const v = raw ? Number(raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : null;
      clearCard(ds.id);
      act(() => rpc('mark_sold', { p_id: Number(ds.id), p_value: Number.isFinite(v) ? v : null }), 'Venda anotada.', ds.id);
    },
    close: (ds) => { clearCard(ds.id); act(() => rpc('close_cycle', { p_id: Number(ds.id), p_reason: 'encerrada' }), 'Conversa encerrada.', ds.id); },
    stop: (ds) => {
      if (ds.id) clearCard(ds.id);
      act(() => rpc('stop_customer', { p_code: ds.code, p_id: ds.id ? Number(ds.id) : null }), 'Pronto: não recebe mais mensagens.', ds.id || null);
    },
    undo: (ds) => {
      if (ds.toast) document.getElementById('toast-root').innerHTML = '';
      clearCard(ds.id);
      act(() => rpc('undo_last', { p_id: Number(ds.id) }), 'Desfeito.');
    },
    customer: (ds) => openCustomer(ds.code),
    'sheet-close': (ds, el, e) => {
      if (e.target.closest('[data-stop]') && !el.matches('.link-btn')) return;
      S.sheet = null;
      S.catalogOpen = false;
      renderSheet();
    },
    manual: (ds) => act(async () => { await rpc('start_manual', { p_code: ds.code }); S.view = 'hoje'; S.tab = 'novos'; S.sheet = null; }, 'Entrou na lista de hoje.'),
    generate: async () => {
      if (S.generating || S.busy) return;
      S.generating = 'Montando a lista...'; render();
      try {
        const n = await rpc('generate_daily_list', { p_date: null, p_force: false });
        if (!DEMO) {
          S.generating = 'Escrevendo as mensagens com as peças da semana... (1 a 2 minutos)'; render();
          try { await callIa({ action: 'write' }); } catch (e) { console.error(e); }
        }
        await loadBoard(true);
        toast(n ? `Lista pronta: ${n} clientes.` : 'A lista de hoje já existe.');
      } catch (e) { console.error(e); toast(errorText(e)); }
      S.generating = null; render();
    },
    'results-refresh': () => loadResults(),
    catalog: () => openCatalog(),
    'catalog-toggle': () => { S.catalogListOpen = !S.catalogListOpen; render(); },
    'catalog-share': (ds) => shareCatalog(ds.name),
    'catalog-del': (ds) => removeCatalog(ds.name),
    'ia-rewrite': async () => {
      if (S.uploading) return;
      S.uploading = true; S.uploadMsg = 'Escrevendo as mensagens com as peças da semana...'; render();
      try {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
        const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        const t = new Date(d); t.setDate(d.getDate() + 1);
        const a = await callIa({ action: 'write', date: iso(d), force: true });
        const b = await callIa({ action: 'write', date: iso(t), force: true });
        toast(`Pronto: ${(a.written || 0) + (b.written || 0)} mensagens reescritas.`);
      } catch (e) { console.error(e); toast('Não deu certo. Tente de novo.'); }
      S.uploading = false; S.uploadMsg = '';
      await loadBoard(true); render();
    },
    'login-role': (ds) => { S.login.role = ds.r; S.login.error = ''; try { localStorage.setItem('lista-role', ds.r); } catch (e) { /* sem storage */ } render(); },
    logout: async () => {
      if (DEMO) { location.href = location.pathname; return; }
      await sb.auth.signOut();
      S.phase = 'login';
      S.board = null;
      render();
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'sheet-close' && el.classList.contains('sheet-bg') && e.target !== el) return;
    if (handlers[act]) {
      e.preventDefault();
      handlers[act](el.dataset, el, e);
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('textarea[data-edit]')) S.edits[t.dataset.edit] = t.value;
    if (t.id === 'search-input') onSearch(t.value);
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'catalog-input') uploadCatalog([...e.target.files]);
  });

  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'login-form') {
      e.preventDefault();
      const password = new FormData(e.target).get('password');
      const email = (CFG.users || {})[S.login.role];
      S.login.loading = true;
      S.login.error = '';
      render();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      S.login.loading = false;
      if (error) { S.login.error = 'Senha errada. Tente de novo.'; render(); return; }
      try { localStorage.setItem('lista-role', S.login.role); } catch (err) { /* sem storage */ }
      // Pede ao navegador para guardar a senha neste aparelho (Chrome/Android; iPhone usa o Chaves do iCloud sozinho).
      try {
        if (window.PasswordCredential && navigator.credentials) {
          await navigator.credentials.store(new window.PasswordCredential({ id: email, password, name: S.login.role === 'dona' ? 'Baummer Nações (Dona)' : 'Baummer Nações (Loja)' }));
        }
      } catch (err) { /* ok */ }
      S.phase = 'loading';
      render();
      await loadBoard();
    }
    if (e.target.id === 'settings-form') {
      e.preventDefault();
      const f = new FormData(e.target);
      const p = {};
      ['daily_new', 'bump_hours', 'followup_every_days', 'followup_max', 'rest_days'].forEach((k) => {
        const v = String(f.get(k) || '').replace(',', '.');
        if (v !== '') p[k] = Number(v);
      });
      p.campaign_line = String(f.get('campaign_line') || '');
      act(() => rpc('update_settings', { p }), 'Ajustes salvos.');
    }
  });

  // Atualiza sozinho a cada minuto (para os lembretes aparecerem na hora).
  setInterval(() => {
    const a = document.activeElement;
    const editing = a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT');
    if (S.phase === 'app' && S.view === 'hoje' && document.visibilityState === 'visible' && !S.busy && !editing && !S.sheet) {
      loadBoard(true).then(render);
    }
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.phase === 'app' && !S.busy) loadBoard(true).then(() => { if (S.view === 'hoje') render(); });
  });

  // ------------------------------------------------------------------ modo demonstração
  const Demo = (() => {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const local = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
    const today = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
    const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    const people = [
      ['Ana Souza', 'Ana', ['aniversario:2:quarta', 'natal', 'conjunto', 'vip', 'frequente:9'], 'Oi Ana, tudo bem? Aqui é da Baummer Nações. Seu aniversário é nesta quarta, então já deixamos nosso feliz aniversário adiantado! E como está o brinco que você levou? Chegaram peças que combinam com ele e formam o conjunto. Quer que a gente te mande fotos?'],
      ['Beatriz Lima', 'Beatriz', ['aniversario:1:terça', 'natal', 'sumida', 'vip'], 'Oi Beatriz, tudo bem? Aqui é da Baummer Nações. Amanhã é seu aniversário, né? Feliz aniversário adiantado! Faz um tempinho que você não passa aqui, e chegaram pulseiras novas folheadas a ouro que são a sua cara. Quer que a gente separe algumas pra você ver?'],
      ['Carla Mendes', 'Carla', ['natal', 'vip', 'frequente:7'], 'Oi Carla, tudo bem? Aqui é da Baummer Nações. No Natal passado você levou corrente e pingente com a gente, e a coleção deste ano já chegou. Quer que a gente te mande algumas ideias?'],
      ['Daniela Rocha', 'Daniela', ['conjunto', 'boa_cliente'], 'Oi Daniela, tudo bem? Aqui é da Baummer Nações. Como está o colar de zircônia que você levou? Chegaram peças que combinam com ele e formam o conjunto. Quer que a gente te mande fotos?'],
      ['Elaine Costa', 'Elaine', ['sumida', 'vip', 'frequente:5'], 'Oi Elaine, tudo bem? Aqui é da Baummer Nações. Faz um tempinho que você não passa aqui, e chegaram brincos novos folheados a ouro que são a sua cara. Quer ver algumas fotos?'],
      ['Fernanda Alves', 'Fernanda', ['natal', 'sumida'], 'Oi Fernanda, tudo bem? Aqui é da Baummer Nações. No Natal passado você levou anel e brinco com a gente, e a coleção deste ano já chegou. Quer que a gente te mande algumas ideias?'],
      ['Gabriela Nunes', 'Gabriela', ['aniversario:5:sábado', 'boa_cliente'], 'Oi Gabriela, tudo bem? Aqui é da Baummer Nações. Seu aniversário é neste sábado, então já deixamos nosso feliz aniversário adiantado! Chegaram argolas novas banhadas a ouro, bem do jeito que você gosta. Quer que a gente te mande fotos?'],
      ['Helena Dias', 'Helena', ['sumida', 'frequente:4'], 'Oi Helena, tudo bem? Aqui é da Baummer Nações. Faz um tempinho que você não passa aqui, e chegaram colares novos de prata 925 que são a sua cara. Quer que a gente separe algumas pra você ver?'],
      ['Isabela Martins', 'Isabela', ['natal', 'boa_cliente'], 'Oi Isabela, tudo bem? Aqui é da Baummer Nações. No Natal passado você levou pulseira com a gente, e a coleção deste ano já chegou. Quer que a gente te mande algumas ideias?'],
      ['Juliana Pereira', 'Juliana', ['sumida'], 'Oi Juliana, tudo bem? Aqui é da Baummer Nações. Faz um tempinho que você não passa aqui, e chegaram anéis novos folheados a ouro que são a sua cara. Quer ver algumas fotos?'],
    ];
    let seq = 1;
    const settings = { id: 1, daily_new: 50, bump_hours: 4, followup_every_days: 2, followup_max: 12, rest_days: 60, store_name: 'Baummer Nações', campaign_line: null };
    const customers = people.map((p, i) => ({
      code: `D${i + 1}`, name: p[0], first_name: p[1], phone: `5548${String(991000000 + i * 1371)}`, cidade: 'Criciúma', bairro: 'Centro',
      total_spent: 820 - i * 61, last_period: i % 2 ? '2025-12' : '2026-04', n_periods: 3 + (i % 5),
      last_items: ['BRINCO ZIRCÔNIA PEQUENO OURO FOLHEADO (R$79,90)', 'PULSEIRA RIVIERA PEQUENO OURO FOLHEADO (R$99,90)'],
      birth_date: '1990-11-25', customer_since: '2019-03-10', seller: 'Vendedora 1', do_not_contact: false,
    }));
    const cycles = customers.map((cu, i) => ({
      id: seq++, customer_code: cu.code, list_date: today, origin: 'lista', position: i + 1, score: 100 - i * 5,
      reasons: people[i][2], message: people[i][3],
      bump_message: `Oi ${cu.first_name}, só passando pra ver se você viu nossa mensagem de hoje cedo. Se quiser, a gente te manda as fotos por aqui mesmo.`,
      status: 'pendente', sent_at: null, bump_due_at: null, bump_sent_at: null, replied_at: null, reply_reason: null,
      followups_done: 0, next_followup_on: null, last_followup_at: null, sold_at: null, sale_value: null, closed_at: null, close_reason: null, updated_at: ago(1),
    }));
    // Duas enviadas mais cedo hoje (um lembrete já na hora, outro mais tarde) e uma conversa em andamento.
    const startOfDay = Date.now() - ((local.getHours() * 60 + local.getMinutes()) * 60 + local.getSeconds()) * 1000;
    const earlier = (h) => new Date(Math.max(Date.now() - h * 3600e3, startOfDay + 60e3)).toISOString();
    Object.assign(cycles[8], { status: 'enviada', sent_at: earlier(5), bump_due_at: new Date(Date.now() - 60e3).toISOString(), updated_at: earlier(5) });
    Object.assign(cycles[9], { status: 'enviada', sent_at: earlier(1), bump_due_at: new Date(Date.now() + 3 * 3600e3).toISOString(), updated_at: earlier(1) });
    const extraCu = { code: 'D99', name: 'Larissa Gomes', first_name: 'Larissa', phone: '5548999909999', cidade: 'Criciúma', bairro: 'Pio Correa', total_spent: 410, last_period: '2026-02', n_periods: 4, last_items: ['ANEL CORAÇÃO PEQUENO OURO FOLHEADO (R$64,90)'], do_not_contact: false };
    customers.push(extraCu);
    cycles.push({ id: seq++, customer_code: 'D99', list_date: '2026-01-01', origin: 'lista', position: 3, score: 60, reasons: ['sumida'], message: '', bump_message: '', status: 'respondeu', sent_at: ago(72), replied_at: ago(70), reply_reason: 'fotos', followups_done: 1, next_followup_on: today, last_followup_at: ago(48), updated_at: ago(48), bump_sent_at: null, bump_due_at: null, sold_at: null, sale_value: null, closed_at: null, close_reason: null });
    const history = [];
    const events = [];
    const cu = (code) => customers.find((x) => x.code === code);
    const withCu = (c) => Object.assign({}, c, { customer: cu(c.customer_code) });
    const byId = (id) => cycles.find((c) => c.id === Number(id));
    const snap = (c, kind, detail) => { history.push({ id: c.id, before: JSON.parse(JSON.stringify(c)), kind }); events.push({ kind, at: new Date().toISOString(), detail: detail || {} }); };
    const isToday = (ts) => ts && new Date(new Date(ts).toLocaleString('en-US', { timeZone: TZ })).toDateString() === local.toDateString();
    const addDays = (n) => { const d = new Date(local); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const api = {
      today_board() {
        return {
          date: today, now: new Date().toISOString(), role: 'dona', settings,
          novos: cycles.filter((c) => c.list_date === today).sort((a, z) => a.position - z.position).map(withCu),
          lembretes: cycles.filter((c) => c.status === 'enviada' && !c.bump_sent_at && isToday(c.sent_at)).sort((a, z) => a.bump_due_at.localeCompare(z.bump_due_at)).map(withCu),
          lembretes_feitos: cycles.filter((c) => isToday(c.bump_sent_at)).map(withCu),
          followups: cycles.filter((c) => c.status === 'respondeu' && c.next_followup_on <= today && c.followups_done < settings.followup_max).map(withCu),
          followups_feitos: cycles.filter((c) => isToday(c.last_followup_at)).map(withCu),
          conversando: cycles.filter((c) => c.status === 'respondeu').length,
        };
      },
      mark_sent({ p_id, p_message }) {
        const c = byId(p_id);
        if (c.status === 'pendente') { snap(c, 'enviada'); Object.assign(c, { status: 'enviada', sent_at: new Date().toISOString(), bump_due_at: new Date(Date.now() + settings.bump_hours * 3600e3).toISOString(), message: p_message || c.message, updated_at: new Date().toISOString() }); }
        return withCu(c);
      },
      mark_bump_sent({ p_id }) { const c = byId(p_id); snap(c, 'lembrete'); Object.assign(c, { bump_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }); return withCu(c); },
      mark_replied({ p_id, p_reason }) {
        const c = byId(p_id);
        snap(c, p_reason === 'nao_quer' ? 'parar' : 'respondeu');
        const t = new Date().toISOString();
        if (p_reason === 'nao_quer') { Object.assign(c, { status: 'encerrada', replied_at: t, reply_reason: p_reason, closed_at: t, close_reason: 'parar' }); cu(c.customer_code).do_not_contact = true; }
        else if (p_reason === 'agora_nao') Object.assign(c, { status: 'encerrada', replied_at: t, reply_reason: p_reason, closed_at: t, close_reason: 'agora_nao' });
        else Object.assign(c, { status: 'respondeu', replied_at: t, reply_reason: p_reason, followups_done: 0, next_followup_on: addDays(settings.followup_every_days) });
        c.updated_at = t;
        return withCu(c);
      },
      mark_followup_sent({ p_id }) { const c = byId(p_id); snap(c, 'follow_up'); Object.assign(c, { followups_done: c.followups_done + 1, last_followup_at: new Date().toISOString(), next_followup_on: addDays(settings.followup_every_days), updated_at: new Date().toISOString() }); return withCu(c); },
      mark_sold({ p_id, p_value }) { const c = byId(p_id); snap(c, 'vendeu', { value: p_value }); Object.assign(c, { status: 'vendeu', sold_at: new Date().toISOString(), sale_value: p_value, updated_at: new Date().toISOString() }); return withCu(c); },
      close_cycle({ p_id, p_reason }) { const c = byId(p_id); snap(c, 'encerrada'); Object.assign(c, { status: 'encerrada', closed_at: new Date().toISOString(), close_reason: p_reason, updated_at: new Date().toISOString() }); return withCu(c); },
      stop_customer({ p_code, p_id }) { cu(p_code).do_not_contact = true; if (p_id) { const c = byId(p_id); snap(c, 'parar'); Object.assign(c, { status: 'encerrada', close_reason: 'parar', closed_at: new Date().toISOString() }); } return { ok: true }; },
      undo_last({ p_id }) {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].id === Number(p_id)) {
            const h = history.splice(i, 1)[0];
            const c = byId(p_id);
            Object.assign(c, h.before);
            if (h.kind === 'parar') cu(c.customer_code).do_not_contact = false;
            events.pop();
            break;
          }
        }
        return withCu(byId(p_id));
      },
      search_customers({ p_q }) {
        const q = String(p_q || '').toLowerCase();
        return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, '') || '@'))
          .map((c) => { const last = cycles.filter((y) => y.customer_code === c.code).pop(); return Object.assign({}, c, { last_cycle: last ? { id: last.id, status: last.status, close_reason: last.close_reason } : null }); });
      },
      customer_detail({ p_code }) {
        const c = cu(p_code);
        return Object.assign({}, c, {
          cycles: cycles.filter((y) => y.customer_code === p_code).map(withCu).reverse(),
          purchases: (c.last_items || []).map((d) => ({ period: c.last_period, description: d, paid: 79.9 })),
        });
      },
      start_manual() { throw new Error('No modo demonstração não dá para adicionar clientes.'); },
      generate_daily_list() { return 0; },
      update_settings({ p }) { Object.assign(settings, p, { campaign_line: p.campaign_line ? p.campaign_line : null }); return settings; },
      results_summary() {
        const cnt = (k) => events.filter((e) => e.kind === k).length;
        const dias = [];
        for (let i = 0; i < 7; i++) dias.push({ d: addDays(-i), enviadas: i ? 40 + i : cnt('enviada') + 2, lembretes: i ? 30 : cnt('lembrete'), respostas: i ? 6 + (i % 3) : cnt('respondeu') + cnt('parar'), follow_ups: i ? 4 : cnt('follow_up'), vendas: i ? i % 3 : cnt('vendeu'), valor: i ? (i % 3) * 159.9 : events.filter((e) => e.kind === 'vendeu').reduce((s, e) => s + Number(e.detail.value || 0), 0) });
        return { dias, agora: { conversando: cycles.filter((c) => c.status === 'respondeu').length, aguardando: cycles.filter((c) => c.status === 'enviada').length, vendas: cycles.filter((c) => c.status === 'vendeu').length, valor: cycles.reduce((s, c) => s + Number(c.sale_value || 0), 0), nao_querem: customers.filter((c) => c.do_not_contact).length, clientes_com_whatsapp: 13402 } };
      },
    };
    return {
      rpc: async (name, args) => {
        await new Promise((r) => setTimeout(r, 120));
        if (!api[name]) throw new Error(`demo: ${name}`);
        return JSON.parse(JSON.stringify(api[name](args)));
      },
    };
  })();

  // ------------------------------------------------------------------ início
  async function boot() {
    render();
    if (DEMO) { await loadBoard(); return; }
    const { data } = await sb.auth.getSession();
    if (data && data.session) await loadBoard();
    else { S.phase = 'login'; render(); }
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { S.phase = 'login'; S.board = null; render(); }
    });
  }
  boot();
})();
