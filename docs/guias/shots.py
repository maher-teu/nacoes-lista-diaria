import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='pt-BR', timezone_id='America/Sao_Paulo')
        pg = await ctx.new_page()
        CSS = '.top{position:static!important}.nav{position:static!important}.banner.demo{display:none!important}#toast-root{display:none}'
        async def fix(toast=False):
            await pg.add_style_tag(content=CSS + ('#toast-root{display:block!important}' if toast else ''))
        async def shot(name, sel=None, full=False, toast=False):
            await fix(toast)
            await pg.wait_for_timeout(500)
            if sel:
                await pg.locator(sel).first.screenshot(path=f'shots/{name}.png')
            else:
                await pg.screenshot(path=f'shots/{name}.png', full_page=full)
        # login (real app, no session)
        await pg.goto(B+'?demo=1&login=1'); await pg.wait_for_timeout(1500)
        await shot('01_login')
        await pg.click('[data-act=login-role][data-r=dona]'); await shot('01b_login_dona')
        # demo
        await pg.goto(B+'?demo=1'); await pg.wait_for_timeout(1500)
        await shot('02_hoje_top')
        await shot('03_card', 'article.card')
        await pg.click('article.card [data-act=wa]'); await pg.wait_for_timeout(800)
        await shot('04_confirm', 'article.card')
        await pg.click('article.card [data-act=sent]'); await pg.wait_for_timeout(600)
        await shot('05_toast', toast=True); await pg.add_style_tag(content='#toast-root{display:none!important}')
        await pg.click('article.card [data-act=skip]'); await shot('06_skip', 'article.card')
        await pg.click('article.card [data-act=back]')
        await pg.click('[data-act=tab][data-tab=lembretes]'); await pg.wait_for_timeout(500)
        await shot('07_lembrete', 'article.card')
        await pg.click('article.card [data-act=reply-ask]'); await shot('08_reply', 'article.card')
        await pg.click('article.card [data-act=back]')
        await pg.click('article.card [data-act=bump-no]'); await shot('08b_bump', 'article.card')
        await pg.click('[data-act=tab][data-tab=followups]'); await pg.wait_for_timeout(500)
        await shot('09_follow', 'article.card')
        await pg.click('[data-act=nav][data-view=clientes]'); await pg.wait_for_timeout(500)
        await pg.fill('#search-input', 'Carla'); await pg.wait_for_timeout(1200)
        await shot('10_clientes')
        await pg.locator('[data-act=customer]').first.click(); await pg.wait_for_timeout(900)
        await shot('11_ficha', '.sheet')
        await pg.click('.sheet-bg', position={'x':5,'y':5}); await pg.wait_for_timeout(300)
        await pg.click('[data-act=nav][data-view=resultados]'); await pg.wait_for_timeout(1200)
        await shot('12_resultados')
        for i,sec in enumerate(await pg.locator('section.section').all()):
            await sec.screenshot(path=f'shots/13_res_{i}.png')
        print(await pg.inner_text('body'))
        await b.close()
asyncio.run(main())
