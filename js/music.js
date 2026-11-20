/** Фоновая музыка: свой mp3 или лёгкий праздничный WebAudio-луп */

let audioEl = null;
let ctx = null;
let master = null;
let timer = null;
let muted = false;
let started = false;

function setMuteUi(btn) {
  if (!btn) return;
  btn.textContent = muted ? "♪̸" : "♪";
  btn.classList.toggle("muted", muted);
}

async function tryStartMp3() {
  audioEl = new Audio("./assets/music.mp3");
  audioEl.loop = true;
  audioEl.volume = 0.45;
  audioEl.playsInline = true;
  await audioEl.play();
  return true;
}

function scheduleLoop(time) {
  // Простой весёлый «party» паттерн (не Fortnite — свой)
  const tempo = 112;
  const beat = 60 / tempo;
  const root = 196; // G3
  const scale = [0, 3, 5, 7, 10, 12, 15, 17];

  for (let i = 0; i < 8; i++) {
    const t = time + i * beat;
    const note = root * Math.pow(2, scale[i % scale.length] / 12);

    // kick every beat
    {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.15);
    }

    // sparkle lead
    {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(note * 2, t + 0.02);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.85);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + beat);
    }
  }

  timer = setTimeout(() => {
    if (!started || muted || audioEl) return;
    scheduleLoop(ctx.currentTime + 0.02);
  }, beat * 8 * 1000 - 40);
}

async function startSynth() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  if (ctx.state === "suspended") await ctx.resume();
  scheduleLoop(ctx.currentTime + 0.05);
}

export async function startMusic() {
  if (started) return;
  started = true;
  muted = false;
  try {
    await tryStartMp3();
  } catch {
    audioEl = null;
    await startSynth();
  }
}

export function toggleMute(btn) {
  muted = !muted;
  if (audioEl) {
    audioEl.muted = muted;
    if (!muted) audioEl.play().catch(() => {});
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 0.35, ctx.currentTime, 0.03);
  }
  setMuteUi(btn);
}

export function isMuted() {
  return muted;
}
