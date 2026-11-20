import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { startMusic, toggleMute } from "./music.js";

const STATUS = document.getElementById("status");
const LABEL = document.getElementById("emote-label");
const START_BTN = document.getElementById("start-btn");
const PREV_BTN = document.getElementById("prev-btn");
const NEXT_BTN = document.getElementById("next-btn");
const MUTE_BTN = document.getElementById("mute-btn");
const OVERLAY = document.getElementById("start-overlay");
const CONFETTI_CANVAS = document.getElementById("confetti");
const UNLOCK = document.getElementById("unlock-banner");

let unlockShown = false;

function showUnlock() {
  if (!UNLOCK || unlockShown) return;
  unlockShown = true;
  UNLOCK.classList.remove("hide");
  UNLOCK.classList.add("show");
  UNLOCK.setAttribute("aria-hidden", "false");
  window.setTimeout(() => {
    UNLOCK.classList.add("hide");
    UNLOCK.classList.remove("show");
    window.setTimeout(() => {
      UNLOCK.classList.remove("hide");
      UNLOCK.setAttribute("aria-hidden", "true");
    }, 400);
  }, 2600);
}

const MANIFEST_URL = "./models/manifest.json";
const MARKER_MIND = "./assets/targets.mind";

let clipSlots = [];
let clipIndex = 0;
let mixer = null;
let currentAction = null;
const clock = new THREE.Clock();
let mindarThree = null;
let started = false;
let confetti = null;
const loader = new GLTFLoader();
const loading = new Map();

function setStatus(text) {
  if (STATUS) STATUS.textContent = text;
}

function setLabel(text) {
  if (LABEL) LABEL.textContent = text;
}

function sideX() {
  // Преимущественно по бокам экрана
  return Math.random() < 0.5
    ? Math.random() * 0.22
    : 0.78 + Math.random() * 0.22;
}

function createConfetti(canvas) {
  const ctx = canvas.getContext("2d");
  const pieces = Array.from({ length: 10 }, () => ({
    x: sideX(),
    y: Math.random() * -1,
    s: 4 + Math.random() * 5,
    v: 0.0015 + Math.random() * 0.0025,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.06,
    c: ["#FFE566", "#00D4FF", "#FF6B35", "#FFFFFF", "#7CFF6B"][
      (Math.random() * 5) | 0
    ],
  }));

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
  }
  resize();
  window.addEventListener("resize", resize);

  return {
    update() {
      const dpr = devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.y += p.v;
        p.r += p.vr;
        if (p.y > 1.1) {
          p.y = -0.05;
          p.x = sideX();
        }
        ctx.save();
        ctx.translate(p.x * canvas.width, p.y * canvas.height);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        const s = p.s * dpr;
        ctx.fillRect(-s, -s * 0.35, s * 2, s * 0.7);
        ctx.restore();
      }
    },
  };
}

async function ensureClip(index) {
  const slot = clipSlots[index];
  if (!slot) return null;
  if (slot.clip) return slot.clip;
  if (loading.has(index)) return loading.get(index);

  const promise = (async () => {
    const gltf = await loader.loadAsync(`./models/${slot.file}`);
    if (!gltf.animations?.length) throw new Error("no anim in " + slot.file);
    const clip = gltf.animations[0].clone();
    clip.name = slot.label;
    slot.clip = clip;
    return clip;
  })();

  loading.set(index, promise);
  try {
    return await promise;
  } finally {
    loading.delete(index);
  }
}

async function playClip(index) {
  if (!mixer || !clipSlots.length) return;
  clipIndex = ((index % clipSlots.length) + clipSlots.length) % clipSlots.length;
  const slot = clipSlots[clipIndex];
  setLabel(`${clipIndex + 1}/${clipSlots.length} · ${slot.label}…`);

  try {
    const clip = await ensureClip(clipIndex);
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    if (currentAction && currentAction !== action) currentAction.fadeOut(0.2);
    action.reset().fadeIn(0.2).play();
    currentAction = action;
    setLabel(`${clipIndex + 1}/${clipSlots.length} · ${slot.label}`);

    const next = (clipIndex + 1) % clipSlots.length;
    const prev = (clipIndex - 1 + clipSlots.length) % clipSlots.length;
    ensureClip(next).catch(() => {});
    ensureClip(prev).catch(() => {});
  } catch (e) {
    console.error(e);
    setStatus("Не удалось загрузить эмоут");
  }
}

function placeCharacterOnMarker(model) {
  const rig = new THREE.Group();

  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = false;
      if (o.material) {
        o.material.side = THREE.FrontSide;
        o.material.needsUpdate = true;
      }
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const targetHeight = 0.95;
  const scale = targetHeight / (size.y || 1);
  model.scale.setScalar(scale);
  model.position.set(
    -center.x * scale,
    -box.min.y * scale,
    -center.z * scale
  );

  rig.add(model);
  // Стоит из карточки к камере, не вверх ногами
  rig.rotation.x = -Math.PI / 2;
  rig.rotation.z = Math.PI;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 48),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
  );
  shadow.position.z = 0.002;
  shadow.frustumCulled = false;

  const root = new THREE.Group();
  root.add(shadow);
  root.add(rig);
  // Чуть приподнять над меткой, чтобы не уходила внутрь карточки
  root.position.z = 0.02;
  root.frustumCulled = false;
  return { root, model };
}

async function setupAR() {
  setStatus("Подключаем камеру…");

  // Тяжёлый MindAR только по кнопке Start
  const { MindARThree } = await import("mindar-image-three");

  mindarThree = new MindARThree({
    container: document.getElementById("ar-container"),
    imageTargetSrc: MARKER_MIND,
    uiLoading: "no",
    uiScanning: "yes",
    uiError: "yes",
  });

  const { renderer, scene, camera } = mindarThree;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 4, 3);
  scene.add(key);

  const anchor = mindarThree.addAnchor(0);

  // Камера + модель параллельно
  setStatus("Камера + модель…");
  const [mainGltf] = await Promise.all([
    loader.loadAsync("./models/main.glb"),
    mindarThree.start(),
  ]);

  const { root, model } = placeCharacterOnMarker(mainGltf.scene);

  // Следим за меткой плавно, потом фиксируем позу — без прыжков
  const pivot = new THREE.Object3D();
  anchor.group.add(pivot);
  const holder = new THREE.Group();
  holder.visible = false;
  holder.add(root);
  scene.add(holder);

  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scl = new THREE.Vector3();
  const _lastPos = new THREE.Vector3();
  let tracking = false;
  let locked = false;
  let stableTime = 0;

  anchor.onTargetFound = () => {
    tracking = true;
    locked = false;
    stableTime = 0;
    unlockShown = false;
    holder.visible = true;
    pivot.updateWorldMatrix(true, false);
    pivot.matrixWorld.decompose(_pos, _quat, _scl);
    holder.position.copy(_pos);
    holder.quaternion.copy(_quat);
    _lastPos.copy(_pos);
    setStatus("Держи ровно… unlocking");
    showUnlock();
  };
  anchor.onTargetLost = () => {
    tracking = false;
    locked = false;
    stableTime = 0;
    holder.visible = false;
    setStatus("Наведи на карточку с силуэтом");
  };

  const manifest = await fetch(MANIFEST_URL).then((r) => r.json());
  clipSlots = manifest.clips.map((entry) => ({
    file: entry.file,
    label: entry.label,
    id: entry.id,
    clip: null,
  }));
  mixer = new THREE.AnimationMixer(model);

  confetti = createConfetti(CONFETTI_CANVAS);
  started = true;
  OVERLAY.classList.add("hidden");
  setStatus("Наведи на карточку с силуэтом");
  setLabel("Загрузка Action…");

  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (tracking) {
      pivot.updateWorldMatrix(true, false);
      pivot.matrixWorld.decompose(_pos, _quat, _scl);

      if (!locked) {
        // Сильное сглаживание
        const a = 1 - Math.exp(-5 * dt);
        holder.position.lerp(_pos, a);
        holder.quaternion.slerp(_quat, a);

        const jump = holder.position.distanceTo(_pos);
        const still = _lastPos.distanceTo(_pos);
        _lastPos.copy(_pos);

        // Если метка почти не прыгает ~0.45с — зафиксировать
        if (still < 0.004 && jump < 0.02) {
          stableTime += dt;
          if (stableTime > 0.45) {
            locked = true;
            holder.position.copy(_pos);
            holder.quaternion.copy(_quat);
            setStatus("Метка зафиксирована ✓");
          }
        } else {
          stableTime = 0;
        }
      }
      // locked: позицию больше не трогаем — модель стоит ровно
    }
    if (mixer) mixer.update(dt);
    if (confetti) confetti.update();
    renderer.render(scene, camera);
  });

  // Только первый эмоут; соседние подгрузятся при переключении
  await playClip(0);
}

function nextEmote(dir = 1) {
  playClip(clipIndex + dir);
}

START_BTN.addEventListener("click", async () => {
  START_BTN.disabled = true;
  try {
    await startMusic();
    await setupAR();
  } catch (err) {
    console.error(err);
    setStatus("Ошибка: " + (err?.message || err));
    START_BTN.disabled = false;
  }
});

PREV_BTN.addEventListener("click", () => nextEmote(-1));
NEXT_BTN.addEventListener("click", () => nextEmote(1));
MUTE_BTN?.addEventListener("click", () => toggleMute(MUTE_BTN));

window.addEventListener("keydown", (e) => {
  if (!started) return;
  if (e.key === "ArrowLeft") nextEmote(-1);
  if (e.key === "ArrowRight") nextEmote(1);
});
