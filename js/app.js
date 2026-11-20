import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MindARThree } from "mindar-image-three";

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

function createConfetti(canvas) {
  const ctx = canvas.getContext("2d");
  const pieces = Array.from({ length: 60 }, () => ({
    x: Math.random(),
    y: Math.random() * -1,
    s: 4 + Math.random() * 6,
    v: 0.002 + Math.random() * 0.004,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.1,
    c: ["#FFE8A3", "#E76F51", "#F4A261", "#FFFFFF", "#2A9D8F"][
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.y += p.v;
        p.r += p.vr;
        if (p.y > 1.1) {
          p.y = -0.05;
          p.x = Math.random();
        }
        ctx.save();
        ctx.translate(p.x * canvas.width, p.y * canvas.height);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s, -p.s / 2, p.s, p.s / 2);
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
    setStatus(`Загрузка: ${slot.label}…`);
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
    setStatus("Наведи на метку на карточке");

    // Подгружаем соседние в фоне
    const next = (clipIndex + 1) % clipSlots.length;
    const prev = (clipIndex - 1 + clipSlots.length) % clipSlots.length;
    ensureClip(next).catch(() => {});
    ensureClip(prev).catch(() => {});
  } catch (e) {
    console.error(e);
    setStatus("Не удалось загрузить эмоут");
  }
}

async function initClips(sceneRoot, mainGltf) {
  const manifest = await fetch(MANIFEST_URL).then((r) => r.json());
  clipSlots = manifest.clips.map((entry) => ({
    file: entry.file,
    label: entry.label,
    id: entry.id,
    clip: null,
  }));

  mixer = new THREE.AnimationMixer(sceneRoot);
  // Главный эмоут — Celebrating (первый в manifest)
  await playClip(0);
}

function placeCharacterOnMarker(model) {
  const rig = new THREE.Group();

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const targetHeight = 0.7;
  const scale = targetHeight / (size.y || 1);
  model.scale.setScalar(scale);
  model.position.set(
    -center.x * scale,
    -box.min.y * scale,
    -center.z * scale
  );
  // Табличка в локальном пространстве модели: над головой, лицом туда же, куда она
  const titleCanvas = document.createElement("canvas");
  titleCanvas.width = 1024;
  titleCanvas.height = 256;
  const tctx = titleCanvas.getContext("2d");
  tctx.fillStyle = "rgba(11,29,58,0.78)";
  tctx.fillRect(80, 40, 864, 140);
  tctx.fillStyle = "#FFE8A3";
  tctx.font = "bold 72px Georgia, serif";
  tctx.textAlign = "center";
  tctx.fillText("HAPPY BIRTHDAY", 512, 130);
  const titleTex = new THREE.CanvasTexture(titleCanvas);
  titleTex.colorSpace = THREE.SRGBColorSpace;
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.2),
    new THREE.MeshBasicMaterial({
      map: titleTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  // Y-up модель смотрит в -Z → плоскость разворачиваем к зрителю как лицо
  title.position.set(0, size.y * scale + 0.08, 0);
  title.rotation.y = Math.PI;

  rig.add(model);
  rig.add(title);
  // Стоит на метке (+Z из карточки), не вверх ногами
  rig.rotation.x = -Math.PI / 2;
  rig.rotation.z = Math.PI;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 48),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
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
  setStatus("Готовим камеру…");
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
  setStatus("Загрузка модели…");
  const mainGltf = await loader.loadAsync("./models/main.glb");
  const { root, model } = placeCharacterOnMarker(mainGltf.scene);
  anchor.group.add(root);

  await initClips(model, mainGltf);

  confetti = createConfetti(CONFETTI_CANVAS);

  await mindarThree.start();
  started = true;
  OVERLAY.classList.add("hidden");
  setStatus("Наведи на метку на карточке");

  // Фоном все клипы (файлы уже без мешей, ~3MB суммарно)
  Promise.all(clipSlots.map((_, i) => ensureClip(i))).catch(() => {});

  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (mixer) mixer.update(dt);
    if (confetti) confetti.update();
    renderer.render(scene, camera);
  });
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
