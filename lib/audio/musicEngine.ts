// Pokemon music engine — uses real audio files from /public/music/

let currentTrack: 'menu' | 'battle' | 'victory' | null = null
let currentAudio: HTMLAudioElement | null = null

// ── Crowd ambient — very quiet crowd murmur during battle ─────
let crowdAudio: HTMLAudioElement | null = null

export function startCrowdAmbient() {
  if (typeof window === 'undefined') return
  if (crowdAudio) return
  // Build crowd murmur from Web Audio: filtered pink noise at ~3% volume
  try {
    const ctx = new AudioContext()
    const bufferSize = ctx.sampleRate * 4 // 4 second loop
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    // Pink noise approximation: filtered white noise
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886*b0 + white*0.0555179; b1 = 0.99332*b1 + white*0.0750759
      b2 = 0.96900*b2 + white*0.1538520; b3 = 0.86650*b3 + white*0.3104856
      b4 = 0.55000*b4 + white*0.5329522; b5 = -0.7616*b5 - white*0.0168980
      data[i] = (b0+b1+b2+b3+b4+b5+b6 + white*0.5362) * 0.11
      b6 = white * 0.115926
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    // Low-pass filter: crowd-like 800Hz ceiling
    const lpf = ctx.createBiquadFilter()
    lpf.type = 'lowpass'
    lpf.frequency.value = 800
    // Gain: very quiet
    const gain = ctx.createGain()
    gain.gain.value = 0.04
    src.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination)
    src.start()
    // Store a dummy audio element just as a flag
    crowdAudio = new Audio()
    // Keep context alive via reference
    ;(window as unknown as Record<string, unknown>).__crowdCtx = ctx
  } catch {}
}

export function stopCrowdAmbient() {
  if (typeof window === 'undefined') return
  crowdAudio = null
  try {
    const ctx = (window as unknown as Record<string, unknown>).__crowdCtx as AudioContext | undefined
    if (ctx) { ctx.close(); delete (window as unknown as Record<string, unknown>).__crowdCtx }
  } catch {}
}
let pendingTrack: 'menu' | 'battle' | 'victory' | null = null
let autoplayListenerAdded = false

const TRACKS: Record<'menu' | 'battle' | 'victory', string> = {
  menu:    '/music/Intro.mp3',
  battle:  '/music/Battle.mp3',
  victory: '/music/Victory Theme.mp3',
}

const LOOP: Record<'menu' | 'battle' | 'victory', boolean> = {
  menu:    true,
  battle:  true,
  victory: false,
}

const VOLUME: Record<'menu' | 'battle' | 'victory', number> = {
  menu:    0.5,
  battle:  0.6,
  victory: 0.55,
}

// Each audio element carries its own fade interval so they never clobber each other
function fadeOutAudio(audio: HTMLAudioElement, durationMs: number, cb?: () => void) {
  const steps = 20
  const stepMs = durationMs / steps
  const startVol = audio.volume
  let step = 0
  const iv = setInterval(() => {
    step++
    audio.volume = Math.max(0, startVol * (1 - step / steps))
    if (step >= steps) {
      clearInterval(iv)
      audio.pause()
      audio.currentTime = 0
      cb?.()
    }
  }, stepMs)
}

function fadeInAudio(audio: HTMLAudioElement, targetVol: number, durationMs: number) {
  audio.volume = 0
  const steps = 20
  const stepMs = durationMs / steps
  let step = 0
  const iv = setInterval(() => {
    step++
    audio.volume = Math.min(targetVol, targetVol * (step / steps))
    if (step >= steps) clearInterval(iv)
  }, stepMs)
}

function addAutoplayRetryListener() {
  if (autoplayListenerAdded || typeof window === 'undefined') return
  autoplayListenerAdded = true
  const handler = () => {
    autoplayListenerAdded = false
    if (pendingTrack) {
      const t = pendingTrack
      pendingTrack = null
      currentTrack = null
      startTrack(t)
    }
  }
  window.addEventListener('click', handler, { once: true })
  window.addEventListener('keydown', handler, { once: true })
  window.addEventListener('touchstart', handler, { once: true })
  window.addEventListener('mousemove', handler, { once: true })
}

function startTrack(track: 'menu' | 'battle' | 'victory') {
  currentTrack = track
  const audio = new Audio(TRACKS[track])
  audio.loop = LOOP[track]
  audio.volume = 0
  currentAudio = audio
  const p = audio.play()
  if (p !== undefined) {
    p.then(() => fadeInAudio(audio, VOLUME[track], 600))
     .catch(() => {
       currentTrack = null
       pendingTrack = track
       addAutoplayRetryListener()
     })
  } else {
    fadeInAudio(audio, VOLUME[track], 600)
  }
}

let _muted = false

export function isMusicMuted(): boolean { return _muted }

export function getCurrentTrack(): 'menu' | 'battle' | 'victory' | null { return currentTrack }

export function getCurrentAudio(): HTMLAudioElement | null { return currentAudio }

export function setMusicMuted(muted: boolean) {
  _muted = muted
  if (typeof window === 'undefined') return
  if (muted) {
    if (currentAudio) { currentAudio.pause() }
  } else {
    // Resume current track if one was playing
    if (currentAudio) { currentAudio.play().catch(() => {}) }
    else if (currentTrack) { startTrack(currentTrack) }
  }
}

export function playMusic(track: 'menu' | 'battle' | 'victory') {
  if (typeof window === 'undefined') return
  if (currentTrack === track) return

  pendingTrack = null // cancel any pending track for different song

  // Stop old audio immediately — hard cut, no overlap
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if (!_muted) startTrack(track)
  else currentTrack = track // remember it so unmute can resume
}

export function stopMusic() {
  if (typeof window === 'undefined') return
  currentTrack = null
  pendingTrack = null
  if (currentAudio) {
    fadeOutAudio(currentAudio, 350)
    currentAudio = null
  }
}

export function resumeAudioContext() {
  // No-op — kept for API compatibility
}
