// ═══════════════════════════════════════════════════════════════
// ARENA 151 — WEB AUDIO SFX
// ═══════════════════════════════════════════════════════════════

import { isGlobalMuted } from './musicEngine'

let _ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

// ── Crowd cheer — loud burst of filtered noise, 2.5s ──────────
export function playCrowdCheer() {
  if (isGlobalMuted()) return
  try {
    const ctx = getCtx()
    const duration = 2.5
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer

    // Bandpass to get crowd-frequency range
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1400
    filter.Q.value = 0.4

    // Second filter layer for richness
    const filter2 = ctx.createBiquadFilter()
    filter2.type = 'highpass'
    filter2.frequency.value = 600

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(1.2, ctx.currentTime + 0.15)   // loud fast attack
    gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.5)
    gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 1.2)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)

    source.connect(filter)
    filter.connect(filter2)
    filter2.connect(gain)
    gain.connect(ctx.destination)
    source.start()
  } catch (e) { /* ignore */ }
}

// ── Crowd "OOOOO" — rising filtered noise sweep, 2s ──────────
export function playOooSound() {
  if (isGlobalMuted()) return
  try {
    const ctx = getCtx()
    const duration = 2.0
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(400, ctx.currentTime)
    filter.frequency.linearRampToValueAtTime(1600, ctx.currentTime + duration)
    filter.Q.value = 3.0

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.3)
    gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 1.2)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()
  } catch (e) { /* ignore */ }
}

// ── KO boom — big dramatic impact thud ────────────────────────
export function playKOSound() {
  if (isGlobalMuted()) return
  try {
    const ctx = getCtx()

    // Deep low boom
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(18, ctx.currentTime + 0.8)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(1.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)

    // Mid thud layer
    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(200, ctx.currentTime)
    osc2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5)
    const gain2 = ctx.createGain()
    gain2.gain.setValueAtTime(0.7, ctx.currentTime)
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start()
    osc2.stop(ctx.currentTime + 0.5)

    // High dramatic ping after
    const osc3 = ctx.createOscillator()
    osc3.type = 'triangle'
    osc3.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
    osc3.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.9)
    const gain3 = ctx.createGain()
    gain3.gain.setValueAtTime(0, ctx.currentTime)
    gain3.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.15)
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9)
    osc3.connect(gain3)
    gain3.connect(ctx.destination)
    osc3.start(ctx.currentTime + 0.15)
    osc3.stop(ctx.currentTime + 0.9)
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// ATTACK SOUND EFFECTS — one per animKey family
// ═══════════════════════════════════════════════════════════════

function noise(ctx: AudioContext, dur: number, vol: number, lpFreq = 4000): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpFreq
  const g = ctx.createGain(); g.gain.value = vol
  src.connect(lp); lp.connect(g); g.connect(ctx.destination)
  return src
}

function osc(ctx: AudioContext, type: OscillatorType, freq: number, dur: number, vol: number): OscillatorNode {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq
  const g = ctx.createGain(); g.gain.value = vol
  o.connect(g); g.connect(ctx.destination)
  o.start(); o.stop(ctx.currentTime + dur)
  return o
}

// Fire — crackling roar
function sndFire(ctx: AudioContext, big = false) {
  const t = ctx.currentTime
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = big ? 600 : 900; bp.Q.value = 0.6
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = big ? 1800 : 2400
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(big ? 1.4 : 0.9, t + 0.08)
  g.gain.linearRampToValueAtTime(big ? 1.0 : 0.6, t + 0.35)
  g.gain.linearRampToValueAtTime(0, t + 0.85)
  n.connect(bp); bp.connect(lp); lp.connect(g); g.connect(ctx.destination)
  n.start()
  // Crackle — quick burst
  for (let i = 0; i < (big ? 5 : 3); i++) {
    const cn = ctx.createBufferSource()
    const cb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate)
    const cd = cb.getChannelData(0); for (let j = 0; j < cd.length; j++) cd[j] = Math.random() * 2 - 1
    cn.buffer = cb
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.5, t + i * 0.12); cg.gain.linearRampToValueAtTime(0, t + i * 0.12 + 0.05)
    cn.connect(cg); cg.connect(ctx.destination); cn.start(t + i * 0.12)
  }
}

// Electric — sharp zap with screen flash feel
function sndElectric(ctx: AudioContext, big = false) {
  const t = ctx.currentTime
  // Sharp crack noise
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000
  const g = ctx.createGain()
  g.gain.setValueAtTime(big ? 1.6 : 1.0, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
  n.connect(hp); hp.connect(g); g.connect(ctx.destination); n.start()
  // Electric hum oscillator descending
  const o = ctx.createOscillator(); o.type = 'square'
  o.frequency.setValueAtTime(big ? 600 : 400, t)
  o.frequency.exponentialRampToValueAtTime(big ? 40 : 60, t + 0.4)
  const og = ctx.createGain()
  og.gain.setValueAtTime(big ? 0.5 : 0.3, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
  o.connect(og); og.connect(ctx.destination); o.start(); o.stop(t + 0.4)
}

// Thunder — sky boom
function sndThunder(ctx: AudioContext) {
  const t = ctx.currentTime
  // Flash crack first
  sndElectric(ctx, true)
  // Then deep rumble
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(100, t + 0.05)
  o.frequency.exponentialRampToValueAtTime(20, t + 1.0)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t + 0.05)
  g.gain.linearRampToValueAtTime(1.4, t + 0.15)
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.0)
  o.connect(g); g.connect(ctx.destination); o.start(t + 0.05); o.stop(t + 1.0)
}

// Water — splash + flow
function sndWater(ctx: AudioContext, big = false) {
  const t = ctx.currentTime
  const n = ctx.createBufferSource()
  const dur = big ? 1.0 : 0.6
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = big ? 800 : 1200
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'highpass'; lp2.frequency.value = 200
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(big ? 1.2 : 0.8, t + 0.1)
  g.gain.linearRampToValueAtTime(big ? 0.9 : 0.6, t + dur * 0.5)
  g.gain.linearRampToValueAtTime(0, t + dur)
  n.connect(lp); lp.connect(lp2); lp2.connect(g); g.connect(ctx.destination); n.start()
}

// Ice — crystalline crack + shatter
function sndIce(ctx: AudioContext) {
  const t = ctx.currentTime
  // Crystal ping
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.value = 1800 + i * 400
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.4, t + i * 0.06)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.25)
    o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.25)
  }
  // Ice shard noise
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
  n.connect(hp); hp.connect(g); g.connect(ctx.destination); n.start()
}

// Psychic — eerie pulsing mind wave
function sndPsychic(ctx: AudioContext, big = false) {
  const t = ctx.currentTime
  const dur = big ? 1.2 : 0.8
  const baseFreq = big ? 320 : 400
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(baseFreq, t)
  o.frequency.linearRampToValueAtTime(baseFreq * 1.5, t + dur * 0.4)
  o.frequency.linearRampToValueAtTime(baseFreq * 0.7, t + dur)
  // LFO for wobble
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = big ? 8 : 6
  const lfoGain = ctx.createGain(); lfoGain.gain.value = big ? 40 : 25
  lfo.connect(lfoGain); lfoGain.connect(o.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(big ? 0.7 : 0.5, t + 0.15)
  g.gain.linearRampToValueAtTime(big ? 0.5 : 0.3, t + dur * 0.7)
  g.gain.linearRampToValueAtTime(0, t + dur)
  o.connect(g); g.connect(ctx.destination)
  lfo.start(t); lfo.stop(t + dur)
  o.start(t); o.stop(t + dur)
  // High shimmer
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = big ? 900 : 700
  const g2 = ctx.createGain()
  g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.25, t + 0.1); g2.gain.linearRampToValueAtTime(0, t + dur)
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t); o2.stop(t + dur)
}

// Ghost — eerie low moan + creak
function sndGhost(ctx: AudioContext) {
  const t = ctx.currentTime
  // Low moan
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(80, t); o.frequency.linearRampToValueAtTime(50, t + 1.2)
  const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 4
  const vibG = ctx.createGain(); vibG.gain.value = 10
  vib.connect(vibG); vibG.connect(o.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.4)
  g.gain.linearRampToValueAtTime(0, t + 1.2)
  o.connect(g); g.connect(ctx.destination)
  vib.start(t); vib.stop(t + 1.2); o.start(t); o.stop(t + 1.2)
  // Whoosh
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.7), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 2
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.4, t + 0.2); ng.gain.linearRampToValueAtTime(0, t + 0.7)
  n.connect(bp); bp.connect(ng); ng.connect(ctx.destination); n.start()
}

// Earthquake / ground — deep subsonic boom
function sndGround(ctx: AudioContext, big = false) {
  const t = ctx.currentTime
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(big ? 60 : 80, t)
  o.frequency.exponentialRampToValueAtTime(big ? 15 : 20, t + (big ? 1.2 : 0.8))
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(big ? 1.8 : 1.2, t + 0.06)
  g.gain.exponentialRampToValueAtTime(0.001, t + (big ? 1.2 : 0.8))
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + (big ? 1.2 : 0.8))
  // Rumble debris noise
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400
  const ng = ctx.createGain(); ng.gain.setValueAtTime(big ? 0.8 : 0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
  n.connect(lp); lp.connect(ng); ng.connect(ctx.destination); n.start()
}

// Fighting / punch — sharp impact thud
function sndFight(ctx: AudioContext) {
  const t = ctx.currentTime
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12)
  const g = ctx.createGain(); g.gain.setValueAtTime(1.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + 0.15)
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const ng = ctx.createGain(); ng.gain.setValueAtTime(1.0, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
  n.connect(ng); ng.connect(ctx.destination); n.start()
}

// Dragon — low growl
function sndDragon(ctx: AudioContext) {
  const t = ctx.currentTime
  const o = ctx.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(140, t + 0.3); o.frequency.linearRampToValueAtTime(60, t + 0.9)
  const dist = ctx.createWaveShaper()
  const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = (i * 2) / 256 - 1; curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x)) }
  dist.curve = curve
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.15); g.gain.linearRampToValueAtTime(0, t + 0.9)
  o.connect(dist); dist.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + 0.9)
}

// Grass / leaves — swooshy rustle
function sndGrass(ctx: AudioContext) {
  const t = ctx.currentTime
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.55), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1.2
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + 0.08); g.gain.linearRampToValueAtTime(0, t + 0.55)
  n.connect(bp); bp.connect(g); g.connect(ctx.destination); n.start()
}

// Solar beam — charging hum then BLAST
function sndSolarBeam(ctx: AudioContext) {
  const t = ctx.currentTime
  // Charge hum rising
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(200, t); o.frequency.linearRampToValueAtTime(1200, t + 0.5)
  const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0.8, t + 0.5); g.gain.linearRampToValueAtTime(0, t + 0.55)
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + 0.55)
  // Blast
  setTimeout(() => {
    const ctx2 = getCtx(); const t2 = ctx2.currentTime
    const n = ctx2.createBufferSource()
    const buf = ctx2.createBuffer(1, Math.floor(ctx2.sampleRate * 0.4), ctx2.sampleRate)
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    n.buffer = buf
    const lp = ctx2.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000
    const ng = ctx2.createGain(); ng.gain.setValueAtTime(1.4, t2); ng.gain.exponentialRampToValueAtTime(0.001, t2 + 0.35)
    n.connect(lp); lp.connect(ng); ng.connect(ctx2.destination); n.start()
  }, 520)
}

// Steel — metallic clang + sparks
function sndSteel(ctx: AudioContext) {
  const t = ctx.currentTime
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.value = 1200 + i * 350
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35 - i * 0.06, t + i * 0.035); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.035 + 0.3)
    o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.035); o.stop(t + i * 0.035 + 0.3)
  }
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.8, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
  n.connect(hp); hp.connect(ng); ng.connect(ctx.destination); n.start()
}

// Poison — bubbly toxic drip
function sndPoison(ctx: AudioContext) {
  const t = ctx.currentTime
  for (let i = 0; i < 5; i++) {
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.value = 300 + i * 80
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t + i * 0.07); g.gain.linearRampToValueAtTime(0.3, t + i * 0.07 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.18)
    o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.18)
  }
}

// Bug — high frequency buzz
function sndBug(ctx: AudioContext) {
  const t = ctx.currentTime
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 180
  const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 60
  const lfoG = ctx.createGain(); lfoG.gain.value = 80
  lfo.connect(lfoG); lfoG.connect(o.frequency)
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1000
  const g = ctx.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.linearRampToValueAtTime(0.5, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
  o.connect(hp); hp.connect(g); g.connect(ctx.destination)
  lfo.start(t); lfo.stop(t + 0.45); o.start(t); o.stop(t + 0.45)
}

// Flying / wind — whoosh sweep
function sndWind(ctx: AudioContext) {
  const t = ctx.currentTime
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(400, t); bp.frequency.linearRampToValueAtTime(2500, t + 0.35); bp.Q.value = 1.5
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.15); g.gain.linearRampToValueAtTime(0, t + 0.6)
  n.connect(bp); bp.connect(g); g.connect(ctx.destination); n.start()
}

// Normal / tackle — thud
function sndThud(ctx: AudioContext, heavy = false) {
  const t = ctx.currentTime
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(heavy ? 140 : 200, t); o.frequency.exponentialRampToValueAtTime(heavy ? 30 : 50, t + 0.18)
  const g = ctx.createGain(); g.gain.setValueAtTime(heavy ? 1.6 : 1.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + 0.18)
}

// Rock — stone crash
function sndRock(ctx: AudioContext) {
  const t = ctx.currentTime
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
  const ng = ctx.createGain(); ng.gain.setValueAtTime(1.2, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
  n.connect(lp); lp.connect(ng); ng.connect(ctx.destination); n.start()
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(25, t + 0.25)
  const og = ctx.createGain(); og.gain.setValueAtTime(0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  o.connect(og); og.connect(ctx.destination); o.start(); o.stop(t + 0.25)
}

// Explosion — massive boom
function sndExplosion(ctx: AudioContext) {
  const t = ctx.currentTime
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 }
  n.buffer = buf
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(2.0, t); ng.gain.linearRampToValueAtTime(1.2, t + 0.1); ng.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
  n.connect(lp); lp.connect(ng); ng.connect(ctx.destination); n.start()
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(15, t + 0.9)
  const og = ctx.createGain(); og.gain.setValueAtTime(2.0, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
  o.connect(og); og.connect(ctx.destination); o.start(); o.stop(t + 0.9)
}

// Hyper beam — rising laser charge + blast
function sndHyperBeam(ctx: AudioContext) {
  const t = ctx.currentTime
  const o = ctx.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.6)
  const g = ctx.createGain(); g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0.7, t + 0.55); g.gain.linearRampToValueAtTime(0, t + 0.65)
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + 0.65)
  setTimeout(() => { const c = getCtx(); sndExplosion(c) }, 620)
}

// Aura — golden energy hum
function sndAura(ctx: AudioContext) {
  const t = ctx.currentTime
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(680, t + 0.4); o.frequency.linearRampToValueAtTime(480, t + 0.8)
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 10
  const lfoG = ctx.createGain(); lfoG.gain.value = 20
  lfo.connect(lfoG); lfoG.connect(o.frequency)
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.1); g.gain.linearRampToValueAtTime(0, t + 0.8)
  o.connect(g); g.connect(ctx.destination); lfo.start(t); lfo.stop(t + 0.8); o.start(t); o.stop(t + 0.8)
}

// Stars / Swift — sparkle chime
function sndStars(ctx: AudioContext) {
  const t = ctx.currentTime
  for (let i = 0; i < 6; i++) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 1400 + i * 200
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t + i * 0.05); g.gain.linearRampToValueAtTime(0.3, t + i * 0.05 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.2)
    o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.2)
  }
}

// Dark — low menacing sweep
function sndDark(ctx: AudioContext) {
  const t = ctx.currentTime
  const o = ctx.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5)
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
  const g = ctx.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
  o.connect(lp); lp.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + 0.5)
}

// Slash — sharp swoosh
function sndSlash(ctx: AudioContext) {
  const t = ctx.currentTime
  const n = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  n.buffer = buf
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(800, t); bp.frequency.linearRampToValueAtTime(4000, t + 0.12); bp.Q.value = 2
  const g = ctx.createGain(); g.gain.setValueAtTime(1.0, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  n.connect(bp); bp.connect(g); g.connect(ctx.destination); n.start()
}

// ── Master dispatcher ─────────────────────────────────────────
export function playAttackSound(animKey: string) {
  if (isGlobalMuted()) return
  try {
    const ctx = getCtx()
    switch (animKey) {
      // Fire
      case 'fire': case 'fire_small': case 'fire_stream': case 'fire_spin': sndFire(ctx); break
      case 'fire_blast': case 'mega_fire': sndFire(ctx, true); break
      // Electric
      case 'electric': case 'lightning': sndElectric(ctx); break
      case 'lightning_small': sndElectric(ctx); break
      case 'thunder': sndThunder(ctx); break
      case 'mega_thunder': sndThunder(ctx); break
      // Water
      case 'water': case 'water_wave': case 'water_jet': case 'surf_wave': case 'bubbles': sndWater(ctx); break
      case 'waterfall': case 'tsunami': case 'water_blast': sndWater(ctx, true); break
      // Ice
      case 'ice': case 'ice_beam': sndIce(ctx); break
      case 'blizzard': sndIce(ctx); break
      // Psychic
      case 'psychic': case 'psychic_pulse': case 'psychic_small': sndPsychic(ctx); break
      case 'mind_break': sndPsychic(ctx, true); break
      // Ghost
      case 'ghost': case 'ghost_wave': case 'ghost_ball': case 'nightmare': sndGhost(ctx); break
      // Ground
      case 'ground': sndGround(ctx); break
      case 'quake': sndGround(ctx, true); break
      // Fighting
      case 'fighting': case 'punch': case 'punch_heavy': case 'kick': case 'grapple': sndFight(ctx); break
      // Dragon
      case 'dragon': case 'dragon_breath': sndDragon(ctx); break
      // Grass
      case 'grass': case 'vines': case 'leaves': sndGrass(ctx); break
      case 'solar_beam': sndSolarBeam(ctx); break
      // Steel
      case 'steel': sndSteel(ctx); break
      // Poison
      case 'poison': case 'poison_splash': case 'toxic': sndPoison(ctx); break
      // Bug
      case 'bug': case 'sting': case 'string': sndBug(ctx); break
      // Flying / wind
      case 'flying': case 'wind': case 'sky_attack': case 'sky_wrath': sndWind(ctx); break
      // Normal
      case 'normal': case 'tackle': case 'lick': case 'rage': sndThud(ctx); break
      case 'tackle_heavy': sndThud(ctx, true); break
      // Rock
      case 'rocks': case 'mud': sndRock(ctx); break
      // Slash / dark
      case 'slash': sndSlash(ctx); break
      case 'dark': case 'bite': sndDark(ctx); break
      // Explosion
      case 'explosion': sndExplosion(ctx); break
      // Beams / special
      case 'hyper_beam': sndHyperBeam(ctx); break
      case 'aura': sndAura(ctx); break
      case 'stars': case 'tri_attack': sndStars(ctx); break
      // Teleport / transform / heal — subtle sound
      case 'teleport': case 'transform': case 'heal': sndPsychic(ctx); break
      default: sndThud(ctx); break
    }
  } catch (e) { /* ignore */ }
}

// ── Status condition sounds ────────────────────────────────────
export function playStatusSound(status: string) {
  if (isGlobalMuted()) return
  try {
    const ctx = getCtx()
    const t = ctx.currentTime
    switch (status) {
      case 'poisoned': {
        // Bubbly descent
        for (let i = 0; i < 6; i++) {
          const o = ctx.createOscillator(); o.type = 'sine'
          o.frequency.setValueAtTime(500 - i * 55, t + i * 0.07)
          o.frequency.linearRampToValueAtTime(200 - i * 20, t + i * 0.07 + 0.08)
          const g = ctx.createGain()
          g.gain.setValueAtTime(0, t + i * 0.07)
          g.gain.linearRampToValueAtTime(0.3, t + i * 0.07 + 0.02)
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.1)
          o.connect(g); g.connect(ctx.destination)
          o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.12)
        }
        break
      }
      case 'burned': {
        // Crackle
        for (let i = 0; i < 8; i++) {
          const n = ctx.createBufferSource()
          const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate)
          const d = buf.getChannelData(0); for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1
          n.buffer = buf
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000 + Math.random() * 3000; bp.Q.value = 1
          const g = ctx.createGain(); g.gain.setValueAtTime(0.4, t + i * 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.05)
          n.connect(bp); bp.connect(g); g.connect(ctx.destination); n.start(t + i * 0.06)
        }
        break
      }
      case 'paralyzed': {
        // Short zap
        const o = ctx.createOscillator(); o.type = 'square'
        o.frequency.setValueAtTime(800, t); o.frequency.exponentialRampToValueAtTime(200, t + 0.18)
        const n = ctx.createBufferSource()
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.18), ctx.sampleRate)
        const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
        n.buffer = buf
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000
        const ng = ctx.createGain(); ng.gain.setValueAtTime(0.8, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
        n.connect(hp); hp.connect(ng); ng.connect(ctx.destination); n.start()
        const g = ctx.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + 0.18)
        break
      }
      case 'frozen': {
        // Ice ping — high crystalline tones
        for (let i = 0; i < 4; i++) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 2200 + i * 300
          const g = ctx.createGain()
          g.gain.setValueAtTime(0, t + i * 0.05)
          g.gain.linearRampToValueAtTime(0.35, t + i * 0.05 + 0.01)
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.3)
          o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.3)
        }
        break
      }
      case 'sleep': {
        // Soft descending tones
        for (let i = 0; i < 5; i++) {
          const o = ctx.createOscillator(); o.type = 'sine'
          o.frequency.setValueAtTime(400 - i * 50, t + i * 0.12)
          o.frequency.linearRampToValueAtTime(300 - i * 40, t + i * 0.12 + 0.14)
          const g = ctx.createGain()
          g.gain.setValueAtTime(0, t + i * 0.12)
          g.gain.linearRampToValueAtTime(0.2, t + i * 0.12 + 0.03)
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.16)
          o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.18)
        }
        break
      }
      case 'confused': {
        // Warbly warped tone
        const o = ctx.createOscillator(); o.type = 'sine'
        o.frequency.setValueAtTime(440, t)
        o.frequency.linearRampToValueAtTime(660, t + 0.15)
        o.frequency.linearRampToValueAtTime(330, t + 0.3)
        o.frequency.linearRampToValueAtTime(550, t + 0.45)
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 12
        const lfoG = ctx.createGain(); lfoG.gain.value = 60
        lfo.connect(lfoG); lfoG.connect(o.frequency)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.05)
        g.gain.linearRampToValueAtTime(0, t + 0.5)
        o.connect(g); g.connect(ctx.destination)
        lfo.start(t); lfo.stop(t + 0.5); o.start(t); o.stop(t + 0.5)
        break
      }
      default: break
    }
  } catch (e) { /* ignore */ }
}

// ── Play a random crowd reaction (cheer OR ooo) ───────────────
export function playRandomCrowdReaction() {
  if (isGlobalMuted()) return
  if (Math.random() < 0.5) {
    playCrowdCheer()
  } else {
    playOooSound()
  }
}

// ── Real crowd cheer MP3 — plays first 3 seconds then fades ──
export function playRealCrowdCheer() {
  if (isGlobalMuted()) return
  try {
    const audio = new Audio('/music/Crowd Cheer Sound Effect.mp3')
    audio.volume = 0.85
    audio.play().catch(() => {})
    // Fade out over last 0.5s then stop at 3s
    setTimeout(() => {
      const fadeSteps = 10
      const stepMs = 50
      const startVol = audio.volume
      let step = 0
      const fade = setInterval(() => {
        step++
        audio.volume = Math.max(0, startVol * (1 - step / fadeSteps))
        if (step >= fadeSteps) {
          clearInterval(fade)
          audio.pause()
          audio.currentTime = 0
        }
      }, stepMs)
    }, 2500)
  } catch (e) { /* ignore */ }
}
