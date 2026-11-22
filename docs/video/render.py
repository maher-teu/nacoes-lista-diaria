"""Renderiza o vídeo quadro a quadro e mixa voz, música e efeitos.
Uso: python3 render.py [--preview] [--fps 30]
Se existir voz/parte1..4.mp3, as cenas seguem a duração real da voz."""
import asyncio, json, pathlib, subprocess, sys, re
from playwright.async_api import async_playwright
from narration import SCENES

ROOT = pathlib.Path(__file__).parent
FPS = 30
GAP = 0.35          # respiro entre cenas
LEAD = 0.6          # silêncio antes da primeira fala

def dur(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True)
    return float(out.stdout.strip())

def silences(path, noise='-35dB', d=0.28):
    out = subprocess.run(['ffmpeg', '-i', str(path), '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    return list(zip(starts, ends))

def plan():
    """Devolve as cenas com início/duração e os trechos de voz (arquivo, início no arquivo, fim no arquivo)."""
    voice = {p: ROOT / 'voz' / f'parte{p}.mp3' for p in (1, 2, 3, 4)}
    have = all(v.exists() for v in voice.values())
    scenes, clips, t = [], [], LEAD
    for part in (1, 2, 3, 4):
        items = [s for s in SCENES if s[1] == part]
        if not have:
            for sid, _, _, d in items:
                scenes.append({'id': sid, 'start': round(t, 3), 'dur': d}); t += d + GAP
            continue
        total = dur(voice[part])
        sil = silences(voice[part])
        # fronteiras esperadas pela quantidade de texto; usa o silêncio mais perto de cada uma
        lens = [len(x[2]) for x in items]
        cuts, acc = [], 0
        for L in lens[:-1]:
            acc += L
            target = total * acc / sum(lens)
            best = min(sil, key=lambda s: abs((s[0] + s[1]) / 2 - target)) if sil else (target, target)
            cuts.append(((best[0] + best[1]) / 2))
        bounds = [0.0] + cuts + [total]
        for k, (sid, *_rest) in enumerate(items):
            a, b = bounds[k], bounds[k + 1]
            d = (b - a) + 0.25
            scenes.append({'id': sid, 'start': round(t, 3), 'dur': round(d, 3)})
            clips.append((voice[part], a, b, t))
            t += d + GAP
    scenes[-1]['dur'] += 2.5   # final respira com a música
    return scenes, clips, have

async def frames(scenes, taps, out_video, preview):
    fps = 15 if preview else FPS
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)
        await pg.goto((ROOT / 'comp.html').as_uri())
        await pg.wait_for_timeout(800)
        info = await pg.evaluate('([s, t]) => window.setup(s, t, 7)', [scenes, taps])
        await pg.wait_for_function('[...document.images].every(i => i.complete)')
        total = info['total']
        n = int(total * fps)
        w, h = (540, 960) if preview else (1080, 1920)
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-i', '-',
                               '-vf', f'scale={w}:{h}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28' if preview else '18',
                               '-pix_fmt', 'yuv420p', str(out_video)], stdin=subprocess.PIPE)
        for i in range(n):
            await pg.evaluate(f'window.render({i / fps})')
            ff.stdin.write(await pg.screenshot(type='jpeg', quality=85 if preview else 93))
            if i % 300 == 0: print(f'quadro {i}/{n}', flush=True)
        ff.stdin.close(); ff.wait()
        await b.close()
        return total, info['sfx']

def mix(total, sfx, clips, out_audio):
    """Música baixa sob a voz (ducking), efeitos nos momentos certos."""
    subprocess.run([sys.executable, str(ROOT / 'music.py'), str(total)], cwd=ROOT, check=True, capture_output=True)
    inputs, filters, labels = ['-i', str(ROOT / 'music.wav')], [], []
    idx = 1
    for path, a, b, at in clips:
        inputs += ['-i', str(path)]
        filters.append(f'[{idx}:a]atrim={a:.3f}:{b + 0.15:.3f},asetpts=PTS-STARTPTS,adelay={int(at * 1000)}|{int(at * 1000)},volume=1.0[v{idx}]')
        labels.append(f'[v{idx}]'); idx += 1
    for name, at in sfx:
        f = ROOT / f'sfx_{name}.wav'
        if not f.exists() or at < 0: continue
        inputs += ['-i', str(f)]
        vol = {'tap': .35, 'pop': .3, 'whoosh': .35, 'shimmer': .28, 'success': .35}.get(name, .3)
        filters.append(f'[{idx}:a]adelay={int(at * 1000)}|{int(at * 1000)},volume={vol}[s{idx}]')
        labels.append(f'[s{idx}]'); idx += 1
    voice_labels = [l for l in labels if l.startswith('[v')]
    fx_labels = [l for l in labels if l.startswith('[s')]
    g = []
    if voice_labels:
        g.append(f'{"".join(voice_labels)}amix=inputs={len(voice_labels)}:normalize=0[voice]')
        g.append('[voice]asplit=2[vo1][vo2]')
        g.append('[0:a]volume=0.55[mus]')
        g.append('[mus][vo2]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[duck]')
        g.append(f'[duck][vo1]{"".join(fx_labels)}amix=inputs={2 + len(fx_labels)}:normalize=0[pre]')
    else:
        g.append('[0:a]volume=0.8[mus]')
        g.append(f'[mus]{"".join(fx_labels)}amix=inputs={1 + len(fx_labels)}:normalize=0[pre]')
    g.append(f'[pre]atrim=0:{total:.3f},afade=t=out:st={total - 2.5:.3f}:d=2.5,loudnorm=I=-15:TP=-1.5:LRA=11[out]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters + g), '-map', '[out]', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', str(out_audio)], check=True)

async def main():
    preview = '--preview' in sys.argv
    scenes, clips, have = plan()
    json.dump(scenes, open(ROOT / 'timing.json', 'w'), indent=1)
    taps = json.load(open(ROOT / 'shots' / 'taps.json'))
    total, sfx = await frames(scenes, taps, ROOT / 'video_only.mp4', preview)
    mix(total, sfx, clips, ROOT / 'audio.m4a')
    name = 'preview.mp4' if preview else ('Lista-do-Dia-Guia.mp4' if have else 'Lista-do-Dia-Guia-sem-voz.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(ROOT / 'video_only.mp4'), '-i', str(ROOT / 'audio.m4a'), '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', str(ROOT / name)], check=True)
    print('pronto:', name, round(total, 1), 's', 'com voz' if have else 'sem voz')

asyncio.run(main())
