import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const STATUS = document.getElementById("status");
const LABEL = document.getElementById("emote-label");
const START_BTN = document.getElementById("start-btn");
const PREV_BTN = document.getElementById("prev-btn");
const NEXT_BTN = document.getElementById("next-btn");
const OVERLAY = document.getElementById("start-overlay");
const CONFETTI_CANVAS = document.getElementById("confetti");

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

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const targetHeight = 1.05;
  const scale = targetHeight / (size.y || 1);
  model.scale.setScalar(scale);
  model.position.set(
    -center.x * scale,
    -box.min.y * scale,
    -center.z * scale
  );

  rig.add(model);
  rig.rotation.x = -Math.PI / 2;
  rig.rotation.z = Math.PI;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 48),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
  );
  shadow.position.z = 0.005;

  const root = new THREE.Group();
  root.add(shadow);
  root.add(rig);
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
    // Сглаживание трекинга — меньше дёрганья/«треска» позы
    filterMinCF: 0.0001,
    filterBeta: 0.001,
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
  // Плавное следование за меткой (меньше дрожи без калибровки)
  const smooth = new THREE.Group();
  smooth.visible = false;
  smooth.add(root);
  scene.add(smooth);
  let tracking = false;
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();
  anchor.onTargetFound = () => {
    tracking = true;
    smooth.visible = true;
    anchor.group.matrixWorld.decompose(_pos, _quat, _scale);
    smooth.position.copy(_pos);
    smooth.quaternion.copy(_quat);
  };
  anchor.onTargetLost = () => {
    tracking = false;
    smooth.visible = false;
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
  setStatus("Наведи на метку на карточке");
  setLabel("Загрузка Celebrating…");

  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (tracking) {
      anchor.group.matrixWorld.decompose(_pos, _quat, _scale);
      const a = 1 - Math.exp(-8 * dt);
      smooth.position.lerp(_pos, a);
      smooth.quaternion.slerp(_quat, a);
    }
    if (mixer) mixer.update(dt);
    if (confetti) confetti.update();
    renderer.render(scene, camera);
  });

  // Главный эмоут сразу после старта камеры, остальное в фоне
  await playClip(0);
  for (let i = 1; i < clipSlots.length; i++) {
    ensureClip(i).catch(() => {});
  }
}

function nextEmote(dir = 1) {
  playClip(clipIndex + dir);
}

START_BTN.addEventListener("click", async () => {
  START_BTN.disabled = true;
  try {
    await setupAR();
  } catch (err) {
    console.error(err);
    setStatus("Ошибка: " + (err?.message || err));
    START_BTN.disabled = false;
  }
});

PREV_BTN.addEventListener("click", () => nextEmote(-1));
NEXT_BTN.addEventListener("click", () => nextEmote(1));

window.addEventListener("keydown", (e) => {
  if (!started) return;
  if (e.key === "ArrowLeft") nextEmote(-1);
  if (e.key === "ArrowRight") nextEmote(1);
});
