import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import fs from "fs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = fs
  .readdirSync(".")
  .filter((f) => f.endsWith(".glb"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

for (const f of files) {
  const doc = await io.read(f);
  const root = doc.getRoot();
  const anims = root.listAnimations().map((a) => ({
    name: a.getName() || "(unnamed)",
    channels: a.listChannels().length,
  }));
  const nodes = root.listNodes().map((n) => n.getName());
  const skins = root.listSkins().length;
  const bones = [];
  for (const skin of root.listSkins()) {
    for (const joint of skin.listJoints()) {
      bones.push(joint.getName());
    }
  }
  console.log(
    JSON.stringify(
      {
        file: f,
        anims,
        skins,
        meshCount: root.listMeshes().length,
        sampleBones: bones.slice(0, 8),
        boneCount: bones.length,
      },
      null,
      0
    )
  );
}
