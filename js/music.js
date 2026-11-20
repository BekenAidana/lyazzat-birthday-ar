/** Фоновая музыка: свой mp3 или лёгкий праздничный WebAudio-луп */

let audioEl = null;
let ctx = null;
let master = null;
let timer = null;
let muted = false;
let started = false;
let resuming = false;
let lastResumeAt = 0;

function setMuteUi(btn) {
  if (!btn) return;
  btn.textContent = muted ? "♪̸" : "♪";
  btn.classList.toggle("muted", muted);
}

function wireAudioKeepAlive() {
  if (!audioEl || audioEl.dataset.keepAlive) return;
  audioEl.dataset.keepAlive = "1";

  // iOS/Safari часто ставит на паузу после камеры / ухода с вкладки
  audioEl.addEventListener("pause", () => {
    if (muted || !started || document.hidden) return;
    if (Date.now() - lastResumeAt < 800) return;
    resumeMusic();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && started && !muted) resumeMusic();
  });

  window.addEventListener("pageshow", () => {
    if (started && !muted) resumeMusic();
  });
}

async function tryStartMp3() {
  audioEl = new Audio("./assets/music.mp3");
  audioEl.loop = true;
  audioEl.preload = "auto";
  audioEl.volume = 1; // было 0.45 → в ~3 раза громче (макс браузера)
  audioEl.playsInline = true;
  audioEl.setAttribute("playsinline", "");
  audioEl.setAttribute("webkit-playsinline", "");
  wireAudioKeepAlive();
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
  master.gain.value = 1;
  master.connect(ctx.destination);
  if (ctx.state === "suspended") await ctx.resume();
  scheduleLoop(ctx.currentTime + 0.05);
}

/** После камеры / паузы Safari — снова запустить звук */
export async function resumeMusic() {
  if (!started || muted || resuming) return;
  resuming = true;
  lastResumeAt = Date.now();
  try {
    if (audioEl) {
      audioEl.muted = false;
      if (audioEl.paused) await audioEl.play();
    }
    if (ctx && ctx.state === "suspended") await ctx.resume();
    if (master && ctx) {
      master.gain.setTargetAtTime(1, ctx.currentTime, 0.03);
    }
  } catch {
    // жест пользователя мог уже «протухнуть» — mute-кнопка / стрелки всё ещё могут оживить
  } finally {
    resuming = false;
  }
}

export async function startMusic() {
  if (started) {
    await resumeMusic();
    return;
  }
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
    master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
  }
  if (ctx && !muted && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  setMuteUi(btn);
}

export function isMuted() {
  return muted;
}
