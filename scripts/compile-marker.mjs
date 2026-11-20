import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "assets", "targets.mind");

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".mind": "application/octet-stream",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.join(root, urlPath === "/" ? "compile-auto.html" : urlPath);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});
const page = await browser.newPage();
page.on("console", (msg) => console.log("browser:", msg.text()));

await page.goto(`http://127.0.0.1:${port}/compile-auto.html`, {
  waitUntil: "networkidle",
  timeout: 120000,
});

await page.waitForFunction(() => window.__DONE === true, null, {
  timeout: 180000,
});

const b64 = await page.evaluate(() => window.__MIND_B64);
const buffer = Buffer.from(b64, "base64");
fs.writeFileSync(outPath, buffer);
console.log("wrote", outPath, buffer.length, "bytes");

await browser.close();
server.close();
