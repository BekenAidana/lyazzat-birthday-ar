/**
 * Оставляет в anim-*.glb только кости + клип (без мешей/текстур).
 * main.glb не трогаем — там внешность.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import fs from "fs";
import path from "path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const dir = "models";
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("anim-") && f.endsWith(".glb"))
  .sort();

let before = 0;
let after = 0;

for (const f of files) {
  const src = path.join(dir, f);
  before += fs.statSync(src).size;
  const doc = await io.read(src);
  const root = doc.getRoot();

  // Удаляем меши и материалы/текстуры — анимация на костях останется
  for (const mesh of [...root.listMeshes()]) mesh.dispose();
  for (const mat of [...root.listMaterials()]) mat.dispose();
  for (const tex of [...root.listTextures()]) tex.dispose();

  await doc.transform(dedup(), prune());

  await io.write(src, doc);
  const size = fs.statSync(src).size;
  after += size;
  console.log(`${f}: ${(size / 1024).toFixed(0)} KB`);
}

console.log(
  `anim total: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB`
);
