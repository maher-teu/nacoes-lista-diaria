"""Captura as telas do app (modo demonstração) para o vídeo, com a posição de cada toque."""
import asyncio, json
from playwright.async_api import async_playwright
B = 'http://localhost:8765/'
CSS = '.banner.demo{display:none!important}'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='pt-BR', timezone_id='America/Sao_Paulo')
        pg = await ctx.new_page()
        taps = {}
        async def css(extra=''):
            await pg.add_style_tag(content=CSS + extra)
        async def snap(name, toast=False):
            await pg.add_style_tag(content='#toast-root{display:%s!important}' % ('block' if toast else 'none'))
            await pg.wait_for_timeout(450)
            await pg.screenshot(path=f'shots/{name}.png')
        async def box(name, sel):
            loc = pg.locator(sel).first
            await loc.scroll_into_view_if_needed()
            await pg.wait_for_timeout(200)
            bb = await loc.bounding_box()
            taps[name] = [round((bb['x'] + bb['width'] / 2) / 390, 4), round((bb['y'] + bb['height'] / 2) / 844, 4)]
            return loc
        async def click(name, sel, wait=700):
            loc = await box(name, sel)
            await loc.click(); await pg.wait_for_timeout(wait)

        await pg.goto(B + '?demo=1&login=1'); await pg.wait_for_timeout(900); await css()
        await snap('s01_login')
        await pg.fill('input[name=password]', 'baummer2026'); await box('t_entrar', 'button[type=submit]')
        await snap('s02_login_filled')

        await pg.goto(B + '?demo=1'); await pg.wait_for_timeout(1200); await css()
        await snap('s03_hoje')
        await box('t_tabs', '.tabs, [role=tablist]')
        await pg.evaluate("window.scrollTo(0, 330)"); await pg.wait_for_timeout(400)
        await snap('s04_card_msg')
        await click('t_wa', 'article.card [data-act=wa]', 900)
        await pg.evaluate("window.scrollTo(0, 0)")
        await snap('s05_confirm')
        await click('t_sent', 'article.card [data-act=sent]', 500)
        await pg.evaluate("window.scrollTo(0, 0)")
        await snap('s06_next', toast=True)
        await click('t_skip', 'article.card [data-act=skip]', 500)
        await pg.evaluate("window.scrollTo(0, 0)")
        await snap('s07_skip')
        await click('t_back', 'article.card [data-act=back]', 400)
        await pg.evaluate("window.scrollTo(0, 0)")
        await click('t_lembretes', '[data-act=tab][data-tab=lembretes]', 700)
        await pg.evaluate("window.scrollTo(0, 0)")
        await snap('s08_lembrete')
        await click('t_reply', 'article.card [data-act=reply-ask]', 500)
        await pg.evaluate("window.scrollTo(0, 0)")
        await snap('s09_reply')
        await box('t_fotos', 'article.card [data-act=reply][data-r=fotos]')
        await click('t_back2', 'article.card [data-act=back]', 400)
        await pg.evaluate("window.scrollTo(0, 0)")
        await click('t_follow', '[data-act=tab][data-tab=followups]', 700)
        await pg.evaluate("window.scrollTo(0, 0)")
        await snap('s10_follow')
        await pg.evaluate("window.scrollTo(0, 400)"); await pg.wait_for_timeout(300)
        await box('t_comprou', 'article.card [data-act=sold-ask]')
        await snap('s11_follow_btns')

        await pg.evaluate("window.scrollTo(0, 0)")
        await click('t_clientes', '[data-act=nav][data-view=clientes]', 1200)
        await snap('s12_funil')
        await click('t_conversa', '[data-act=funil-go][data-stage=conversa]', 1200)
        await snap('s13_funil_open')
        await pg.evaluate("window.scrollTo(0, 0)")
        await box('t_search', '#search-input')
        await pg.fill('#search-input', 'Carla'); await pg.wait_for_timeout(1200)
        await snap('s14_search')
        await click('t_carla', '[data-act=customer]', 1100)
        await snap('s15_ficha')
        await click('t_fechar', '.sheet [data-act=sheet-close]', 500)

        await click('t_resultados', '[data-act=nav][data-view=resultados]', 1400)
        await pg.evaluate("window.scrollTo(0, 0)")
        await snap('s16_resultados')
        cat = pg.locator('section.section', has_text='Catálogo da semana').first
        await cat.scroll_into_view_if_needed(); await pg.evaluate("window.scrollBy(0, -90)"); await pg.wait_for_timeout(300)
        await box('t_upload', 'section.section:has-text("Catálogo da semana") label.btn.primary')
        await snap('s17_catalogo')
        camp = pg.locator('textarea').last
        await camp.scroll_into_view_if_needed(); await pg.evaluate("window.scrollBy(0, -160)"); await pg.wait_for_timeout(300)
        await box('t_camp', 'textarea >> nth=-1')
        await snap('s18_campanha_vazia')
        await camp.fill('Até o dia 24, a embalagem de presente é por nossa conta 🎁')
        await snap('s19_campanha')
        await box('t_salvar', 'button:has-text("Salvar ajustes")')
        json.dump(taps, open('shots/taps.json', 'w'), indent=1)
        print(json.dumps(taps))
        await b.close()
asyncio.run(main())
