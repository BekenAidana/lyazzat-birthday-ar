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

let clips = [];
let clipIndex = 0;
let mixer = null;
let currentAction = null;
const clock = new THREE.Clock();
let mindarThree = null;
let started = false;
let confetti = null;

function setStatus(text) {
  if (STATUS) STATUS.textContent = text;
}

function setLabel(text) {
  if (LABEL) LABEL.textContent = text;
}

function createConfetti(canvas) {
  const ctx = canvas.getContext("2d");
  const pieces = Array.from({ length: 80 }, () => ({
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
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s, -p.s / 2, p.s, p.s / 2);
        ctx.restore();
      }
    },
  };
}

function playClip(index) {
  if (!mixer || !clips.length) return;
  clipIndex = ((index % clips.length) + clips.length) % clips.length;
  const next = clips[clipIndex];
  const action = mixer.clipAction(next.clip);
  action.reset();
  action.setLoop(THREE.LoopRepeat, Infinity);
  if (currentAction && currentAction !== action) {
    currentAction.fadeOut(0.25);
  }
  action.reset().fadeIn(0.25).play();
  currentAction = action;
  setLabel(`${clipIndex + 1}/${clips.length} · ${next.label}`);
}

async function loadClips(sceneRoot) {
  const loader = new GLTFLoader();
  const manifest = await fetch(MANIFEST_URL).then((r) => r.json());

  for (const entry of manifest.clips) {
    setStatus(`Загрузка: ${entry.label}…`);
    const gltf = await loader.loadAsync(`./models/${entry.file}`);
    if (!gltf.animations?.length) continue;
    const clip = gltf.animations[0].clone();
    clip.name = entry.label;
    clips.push({ label: entry.label, clip, id: entry.id });
  }

  mixer = new THREE.AnimationMixer(sceneRoot);
  playClip(0);
}

/**
 * MindAR: метка в XY, +Z к камере.
 * Ставим персонажа СТОЯ на карточке (карточка на столе / в руках лицом вверх).
 */
function placeCharacterOnMarker(model) {
  const rig = new THREE.Group();

  // 1) Нормализуем Y-up модель: ступни в нуле
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
  rig.add(model);

  // 2) Поворачиваем: рост уходит вдоль +Z (из метки «вверх» к камере)
  rig.rotation.x = -Math.PI / 2;

  // Тень на метке
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
  // Тень в плоскости метки — отдельный sibling, не внутри rig

  // Табличка над головой (в пространстве метки: z = высота)
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
  title.position.set(0, 0, targetHeight + 0.1);
  title.rotation.x = -Math.PI / 2;

  const root = new THREE.Group();
  root.add(shadow);
  root.add(rig);
  root.add(title);
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
  const loader = new GLTFLoader();
  setStatus("Загрузка модели…");
  const mainGltf = await loader.loadAsync("./models/main.glb");
  const { root, model } = placeCharacterOnMarker(mainGltf.scene);
  anchor.group.add(root);

  await loadClips(model);

  confetti = createConfetti(CONFETTI_CANVAS);

  await mindarThree.start();
  started = true;
  OVERLAY.classList.add("hidden");
  setStatus("Наведи на метку на карточке");

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
