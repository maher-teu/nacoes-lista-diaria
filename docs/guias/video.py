"""Grava um vídeo curto do app (modo demonstração) com legendas e toques visíveis."""
import asyncio, pathlib, shutil
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).parent
B = 'http://localhost:8765/'
OVERLAY = """
(() => {
  if (document.getElementById('cap')) return;
  const st = document.createElement('style');
  st.textContent = `
  #cap{position:fixed;left:12px;right:12px;top:12px;z-index:99999;background:rgba(20,40,32,.94);color:#fff;
    font:700 19px/1.35 Inter,Arial,sans-serif;padding:14px 16px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.25);
    transition:opacity .25s, transform .25s;pointer-events:none}
  #cap small{display:block;font-weight:600;font-size:14px;opacity:.75;margin-bottom:2px;letter-spacing:.5px;text-transform:uppercase;color:#f2b84b}
  #cap.hide{opacity:0;transform:translateY(-8px)}
  .tapdot{position:fixed;z-index:99998;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
    background:rgba(242,184,75,.55);border:3px solid #f2b84b;pointer-events:none;animation:tap .7s ease-out forwards}
  @keyframes tap{0%{transform:scale(.4);opacity:1}100%{transform:scale(1.6);opacity:0}}
  .banner.demo{display:none!important}
  html{zoom:2}
  .login{min-height:0!important;padding-top:110px!important;justify-content:flex-start!important}`;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'cap'; d.className = 'hide'; document.body.appendChild(d);
})();
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await b.new_context(viewport={'width': 780, 'height': 1688}, device_scale_factor=1, locale='pt-BR',
                                  timezone_id='America/Sao_Paulo',
                                  record_video_dir=str(ROOT / 'vid'), record_video_size={'width': 780, 'height': 1688})
        pg = await ctx.new_page()

        async def ov():
            await pg.evaluate(OVERLAY)
            await pg.wait_for_timeout(50)
        async def cap(kicker, text, wait=2600):
            await ov()
            await pg.evaluate("([k,t]) => { const c=document.getElementById('cap'); c.innerHTML='<small>'+k+'</small>'+t; c.className=''; }", [kicker, text])
            await pg.wait_for_timeout(wait)
        async def tap(sel, after=1100):
            loc = pg.locator(sel).first
            await loc.scroll_into_view_if_needed()
            box = await loc.bounding_box()
            await pg.evaluate("([x,y]) => { const d=document.createElement('div'); d.className='tapdot'; d.style.left=x+'px'; d.style.top=y+'px'; document.body.appendChild(d); setTimeout(()=>d.remove(),800); }",
                              [(box['x'] + box['width'] / 2) / 2, (box['y'] + box['height'] / 2) / 2])
            await pg.wait_for_timeout(450)
            await loc.click()
            await pg.wait_for_timeout(after)
            await ov()
        async def scroll(y, wait=900):
            await pg.evaluate(f"window.scrollTo({{top:{y}*2,behavior:'smooth'}})"); await pg.wait_for_timeout(wait)

        # 1. entrar
        await pg.goto(B + '?demo=1&login=1'); await pg.wait_for_timeout(800)
        await cap('Passo 1 · Entrar', 'Abra o app, toque em Loja (ou Dona) e digite a senha.', 3200)
        await tap('[data-act=login-role][data-r=loja]', 700)
        await pg.fill('input[name=password]', '••••••••'); await pg.wait_for_timeout(600)
        await cap('Passo 1 · Entrar', 'O celular pergunta “Salvar senha?”. Toque em Sim. Depois disso ele entra sozinho.', 3200)

        # 2. hoje
        await pg.goto(B + '?demo=1'); await pg.wait_for_timeout(1200)
        await cap('Todo dia às 7h', 'A lista do dia aparece aqui. Três abas: Novos, Lembretes e Follow-ups.', 3600)
        await scroll(250)
        await cap('Mensagem nova', 'A IA escolheu uma peça do catálogo e escreveu a mensagem. Dá para mudar o texto.', 3800)
        await scroll(560)
        await cap('Mensagem nova', 'Toque em “Abrir no WhatsApp”. A conversa abre com a mensagem pronta. Envie.', 2600)
        await tap('article.card [data-act=wa]', 1400)
        await cap('Marcar', 'Voltou do WhatsApp? Toque em “Sim, enviei”.', 2200)
        await tap('article.card [data-act=sent]', 1300)
        await cap('Pronto!', 'A próxima cliente aparece sozinha. Repita até a aba Novos chegar a 0.', 3400)

        # 3. pular / desfazer
        await scroll(0, 600)
        await tap('article.card [data-act=skip]', 900)
        await cap('Pular', 'Número errado? Já estão conversando? Toque em Pular e escolha o motivo.', 3200)
        await tap('article.card [data-act=back]', 700)

        # 4. lembretes
        await scroll(0, 500)
        await tap('[data-act=tab][data-tab=lembretes]', 1000)
        await cap('Lembretes · 4h depois', 'Ela respondeu no WhatsApp? Se não, mande o lembrete.', 3400)
        await tap('article.card [data-act=reply-ask]', 1000)
        await cap('Respondeu', 'Toque no que ela respondeu. Quer ver? Use “Enviar foto da peça”.', 3600)
        await tap('article.card [data-act=reply][data-r=fotos]', 1400)

        # 5. follow-ups
        await scroll(0, 500)
        await tap('[data-act=tab][data-tab=followups]', 1000)
        await cap('Follow-ups', 'Quem respondeu volta a cada 2 dias com uma mensagem nova, até comprar.', 3400)
        await scroll(500)
        await cap('Follow-ups', 'Comprou? Toque em Comprou. Pediu para parar? “Não quer mais”.', 3600)

        # 6. clientes
        await tap('[data-act=nav][data-view=clientes]', 900)
        await cap('Clientes', 'Busque qualquer cliente pelo nome ou telefone.', 2200)
        await pg.type('#search-input', 'Carla', delay=120); await pg.wait_for_timeout(1300)
        await tap('[data-act=customer]', 1300)
        await cap('Ficha da cliente', 'Tudo o que ela comprou, o aniversário e as mensagens já enviadas.', 3400)
        await tap('.sheet [data-act=sheet-close]', 700)

        # 7. dona
        await tap('[data-act=nav][data-view=resultados]', 1400)
        await cap('Só a Dona · Resultados', 'Quantas mensagens a loja enviou hoje, quem respondeu e quanto vendeu.', 3800)
        await scroll(1250, 1200)
        await cap('Só a Dona · Toda semana', 'Domingo à noite: suba o PDF do catálogo. O novo substitui o antigo.', 3800)
        await scroll(1650, 1200)
        await cap('Só a Dona · Campanhas', 'Tem promoção? Escreva aqui. A IA coloca nas mensagens. Acabou? Apague.', 3800)
        await scroll(0, 800)
        await tap('[data-act=nav][data-view=hoje]', 1000)
        await cap('Regra de ouro', 'Todo dia: as 3 abas zeradas e a barra verde cheia. 💛', 3600)

        vpath = await pg.video.path()
        await ctx.close(); await b.close()
        shutil.copy(vpath, ROOT / 'raw.webm')

asyncio.run(main())
