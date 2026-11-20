import * as PImage from "pureimage";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "print", "card-back.png");
const urlPath = path.join(root, "print", "site-url.txt");

const siteUrl = fs.existsSync(urlPath)
  ? fs.readFileSync(urlPath, "utf8").trim()
  : "https://YOUR-SITE.example";

fs.mkdirSync(path.join(root, "print"), { recursive: true });

const W = 1200;
const H = 1600;
const img = PImage.make(W, H);
const ctx = img.getContext("2d");

ctx.fillStyle = "#0B1D3A";
ctx.fillRect(0, 0, W, H);

for (const [fontPath, name] of [
  ["/System/Library/Fonts/Supplemental/Georgia.ttf", "Georgia"],
  ["/System/Library/Fonts/Supplemental/Arial.ttf", "Arial"],
]) {
  if (fs.existsSync(fontPath)) {
    await PImage.registerFont(fontPath, name).load();
  }
}

ctx.fillStyle = "#FFE8A3";
ctx.textAlign = "center";
ctx.font = "42pt Georgia";
ctx.fillText("Открой AR", 600, 220);
ctx.fillStyle = "#FFFFFF";
ctx.font = "24pt Arial";
ctx.fillText("1. Сканируй QR", 600, 300);
ctx.fillText("2. Разреши камеру", 600, 360);
ctx.fillText("3. Наведи на лицевую сторону", 600, 420);

const qrDataUrl = await QRCode.toDataURL(siteUrl, {
  width: 640,
  margin: 2,
  color: { dark: "#0B1D3A", light: "#FFE8A3" },
});
const qrImg = await PImage.decodePNGFromStream(
  // convert data URL to buffer stream
  fs.createReadStream
    ? await (async () => {
        const b64 = qrDataUrl.split(",")[1];
        const buf = Buffer.from(b64, "base64");
        const tmp = path.join(root, "print", "_qr_tmp.png");
        fs.writeFileSync(tmp, buf);
        return fs.createReadStream(tmp);
      })()
    : null
);

ctx.fillStyle = "#FFE8A3";
ctx.fillRect(240, 520, 720, 720);
ctx.drawImage(qrImg, 280, 560, 640, 640);

ctx.fillStyle = "#F4A261";
ctx.font = "18pt Arial";
ctx.fillText(siteUrl, 600, 1320);
ctx.fillStyle = "#FFFFFF";
ctx.font = "20pt Georgia";
ctx.fillText("Happy Birthday, Ляззат", 600, 1420);

await PImage.encodePNGToStream(img, fs.createWriteStream(outPath));
console.log("wrote", outPath, "url=", siteUrl);
try {
  fs.unlinkSync(path.join(root, "print", "_qr_tmp.png"));
} catch {}
