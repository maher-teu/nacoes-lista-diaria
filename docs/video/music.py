"""Trilha original (sem direitos autorais): pop leve e alegre, ~100 BPM, Ré maior. E efeitos sonoros."""
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)

def env(n, a=0.01, d=0.2, s=0.6, r=0.3, hold=None):
    t = np.arange(n) / SR
    hold = hold if hold is not None else n / SR - r
    e = np.where(t < a, t / a, 1.0)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / d, e)
    e = np.where((t >= a + d) & (t < hold), s, e)
    e = np.where(t >= hold, s * np.clip(1 - (t - hold) / r, 0, 1), e)
    return e

def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)

def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)

def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)

def hz(m):
    return 440 * 2 ** ((m - 69) / 12)

def reverb(x, secs=2.2, mix=0.25):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = lp(ir, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(x, ir)[: len(x)]
    return (1 - mix) * x + mix * wet

# Ré maior: D  A  Bm  G  (I V vi IV)
CHORDS = [[62, 66, 69, 74], [57, 61, 64, 69], [59, 62, 66, 71], [55, 59, 62, 67]]
ROOTS = [38, 33, 35, 31]

def pad(dur, notes):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.0, 0.11):
            f = hz(m + det)
            out += (2 * ((t * f) % 1) - 1) * 0.15
    out = lp(out, 1400, 2)
    return out * env(n, a=0.6, d=0.5, s=0.8, r=0.8)

def pluck(dur, m, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = hz(m)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t))
    return x * np.exp(-t * 5.5) * vel * 0.32

def bass(dur, m):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * hz(m) * t) + 0.25 * np.sin(2 * np.pi * hz(m) * 2 * t)
    return x * env(n, a=0.01, d=0.15, s=0.7, r=0.08) * 0.42

def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.85

def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (18 if open_ else 70)) * 0.13

def clap():
    n = int(0.22 * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 900, 3500)
    e = np.exp(-t * 22) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) * 22) * (t > 0.012)
    return x * e * 0.32

def add(buf, x, at):
    i = int(at * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i]

def track(total):
    bars = int(np.ceil(total / BAR)) + 1
    n = int(bars * BAR * SR) + SR * 3
    padb, keys, low, drums = (np.zeros(n) for _ in range(4))
    ARP = [0, 2, 1, 3, 2, 1, 3, 2]
    for b in range(bars):
        t0 = b * BAR
        ch = CHORDS[b % 4]
        add(padb, pad(BAR + 0.6, ch[:3]), t0)
        intro = b < 2
        outro = t0 > total - BAR * 2
        for k in range(8):  # arpejo em colcheias
            note = ch[ARP[k]] + 12
            add(keys, pluck(0.9, note, 0.9 if k % 2 == 0 else 0.65), t0 + k * BEAT / 2)
        if not intro:
            for beat in range(4):
                add(low, bass(BEAT * 0.9, ROOTS[b % 4] + (12 if beat == 3 else 0)), t0 + beat * BEAT)
            if not outro:
                for beat in (0, 2):
                    add(drums, kick(), t0 + beat * BEAT)
                add(drums, kick() * 0.6, t0 + 2.5 * BEAT)
                for beat in (1, 3):
                    add(drums, clap(), t0 + beat * BEAT)
                for k in range(8):
                    add(drums, hat(open_=(k == 7)) * (1.0 if k % 2 else 0.6), t0 + k * BEAT / 2)
    mix = 0.55 * reverb(padb, 2.6, 0.35) + 0.6 * reverb(keys, 1.8, 0.3) + 0.8 * lp(low, 900) + 0.7 * drums
    mix = mix[: int((total + 1.5) * SR)]
    # entrada e saída suaves
    fade_in = int(1.5 * SR); fade_out = int(3.5 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)
    mix[-fade_out:] *= np.linspace(1, 0, fade_out)
    mix /= np.max(np.abs(mix)) + 1e-9
    return mix * 0.9

def sfx():
    out = {}
    # whoosh: ruído com filtro subindo
    n = int(0.7 * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    sweep = np.zeros(n)
    for i, f in enumerate(np.linspace(300, 5000, 14)):
        seg = slice(i * n // 14, (i + 1) * n // 14)
        sweep[seg] = bp(noise, f * 0.7, min(f * 1.4, 20000))[seg]
    out['whoosh'] = reverb(sweep * np.sin(np.pi * t / t[-1]) ** 2 * 0.5, 1.0, 0.3)
    # toque: blip curto
    n = int(0.12 * SR); t = np.arange(n) / SR
    out['tap'] = np.sin(2 * np.pi * (900 + 600 * np.exp(-t * 60)) * t) * np.exp(-t * 40) * 0.5
    # pop: bolha
    n = int(0.18 * SR); t = np.arange(n) / SR
    out['pop'] = np.sin(2 * np.pi * np.cumsum(400 + 900 * t / t[-1]) / SR) * np.exp(-t * 25) * 0.5
    # brilho: arpejo agudo
    n = int(1.2 * SR); x = np.zeros(n)
    for k, m in enumerate([86, 90, 93, 98]):
        add(x, pluck(0.8, m, 0.6), k * 0.07)
    out['shimmer'] = reverb(x, 1.5, 0.4)
    # sucesso: dois tons
    n = int(0.9 * SR); x = np.zeros(n)
    add(x, pluck(0.7, 81, 0.8), 0); add(x, pluck(0.7, 86, 0.9), 0.11)
    out['success'] = reverb(x, 1.2, 0.3)
    return out

if __name__ == '__main__':
    import sys
    total = float(sys.argv[1]) if len(sys.argv) > 1 else 125
    m = track(total)
    wavfile.write('music.wav', SR, (m * 32767).astype(np.int16))
    for k, v in sfx().items():
        v = v / (np.max(np.abs(v)) + 1e-9) * 0.8
        wavfile.write(f'sfx_{k}.wav', SR, (v * 32767).astype(np.int16))
    print('ok', len(m) / SR)
