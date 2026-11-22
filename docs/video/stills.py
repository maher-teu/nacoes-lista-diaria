import asyncio, json, sys
from playwright.async_api import async_playwright
sys.argv=['x']
import importlib.util
spec = importlib.util.spec_from_file_location('r', 'render.py')
src = open('render.py').read().split('async def frames')[0]
ns = {'__file__': '/home/claude/video/render.py'}; exec(src, ns)
scenes, clips, have = ns['plan']()
taps = json.load(open('shots/taps.json'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width':1080,'height':1920})
        await pg.goto('file:///home/claude/video/comp.html'); await pg.wait_for_timeout(600)
        await pg.evaluate('([s,t]) => window.setup(s,t,7)', [scenes, taps])
        await pg.wait_for_function('[...document.images].every(i => i.complete)')
        for s in scenes:
            for f in (0.55, 0.92):
                t = s['start'] + s['dur'] * f
                await pg.evaluate(f'window.render({t})')
                await pg.screenshot(path=f'/tmp/st_{s["id"]}_{int(f*100)}.jpg', type='jpeg', quality=70)
        await b.close()
asyncio.run(main())
