import * as PImage from "pureimage";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "assets", "marker.png");

const W = 1200;
const H = 1600;
const img = PImage.make(W, H);
const ctx = img.getContext("2d");

function fill(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}
function circle(x, y, r, c) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = c;
  ctx.fill();
}
function strokeCircle(x, y, r, c, lw) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = c;
  ctx.lineWidth = lw;
  ctx.stroke();
}

for (let y = 0; y < H; y++) {
  const t = y / H;
  const r = Math.round(11 + 180 * t);
  const g = Math.round(29 + 90 * t);
  const b = Math.round(58 + 40 * (1 - t));
  fill(0, y, W, 1, `rgb(${r},${g},${b + 30})`);
}
fill(0, 0, W, 900, "rgba(11,29,58,0.5)");

for (let y = 0; y < H; y += 48) {
  for (let x = 0; x < W; x += 48) {
    circle(x + 8, y + 8, 4, "rgba(255,232,163,0.55)");
    circle(x + 32, y + 28, 3, "rgba(255,255,255,0.35)");
    fill(x + 20, y + 4, 10, 10, "rgba(231,111,81,0.4)");
  }
}

ctx.strokeStyle = "#FFE8A3";
ctx.lineWidth = 18;
ctx.strokeRect(48, 48, 1104, 1504);
ctx.strokeStyle = "#FFFFFF";
ctx.lineWidth = 6;
ctx.strokeRect(84, 84, 1032, 1432);

ctx.fillStyle = "#FFE8A3";
[
  [120, 140, 1, 1],
  [1080, 140, -1, 1],
  [120, 1460, 1, -1],
  [1080, 1460, -1, -1],
].forEach(([x, y, sx, sy]) => {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 120 * sx, y);
  ctx.lineTo(x + 120 * sx, y + 28 * sy);
  ctx.lineTo(x + 28 * sx, y + 28 * sy);
  ctx.lineTo(x + 28 * sx, y + 120 * sy);
  ctx.lineTo(x, y + 120 * sy);
  ctx.closePath();
  ctx.fill();
});

const fontCandidates = [
  ["/System/Library/Fonts/Supplemental/Georgia.ttf", "Georgia"],
  ["/System/Library/Fonts/Supplemental/Arial.ttf", "Arial"],
  ["/Library/Fonts/Arial Unicode.ttf", "ArialUnicode"],
];

for (const [fontPath, name] of fontCandidates) {
  if (fs.existsSync(fontPath)) {
    const font = PImage.registerFont(fontPath, name);
    await font.load();
  }
}

ctx.textAlign = "center";
ctx.fillStyle = "#FFE8A3";
ctx.font = "48pt Georgia";
ctx.fillText("HAPPY BIRTHDAY", 600, 300);

ctx.fillStyle = "#FFFFFF";
ctx.font = "90pt Georgia";
ctx.fillText("ЛЯЗЗАТ", 600, 480);

circle(600, 880, 210, "#1B4332");
strokeCircle(600, 880, 210, "#FFE8A3", 14);
strokeCircle(600, 880, 168, "#E76F51", 8);
circle(600, 880, 120, "#F4A261");
ctx.fillStyle = "#0B1D3A";
ctx.font = "70pt Georgia";
ctx.fillText("AR", 600, 905);
ctx.font = "22pt Arial";
ctx.fillText("CARD", 600, 955);

ctx.fillStyle = "#FFFFFF";
ctx.font = "24pt Arial";
ctx.fillText("Наведи камеру — и я танцую", 600, 1240);
ctx.fillStyle = "#FFE8A3";
ctx.font = "20pt Arial";
ctx.fillText("с любовью · birthday gift", 600, 1300);

const bars = [
  18, 8, 22, 10, 28, 12, 20, 8, 26, 14, 9, 24, 16, 11, 30, 8, 22, 14, 20, 10, 28,
  16, 8, 24, 18, 12, 30, 14, 20, 16,
];
let bx = 180;
bars.forEach((w, i) => {
  ctx.fillStyle = i % 3 === 0 ? "#FFE8A3" : i % 3 === 1 ? "#FFFFFF" : "#E76F51";
  fill(bx, 1420, w, 70);
  bx += w + 8;
});

await PImage.encodePNGToStream(img, fs.createWriteStream(outPath));
console.log("wrote", outPath, fs.statSync(outPath).size);
