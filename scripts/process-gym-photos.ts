import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { equipmentSeed, mediaStem } from "../src/data/phase-2-catalogue";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(projectRoot, "gym-pictures");
const outputRoot = path.join(projectRoot, "public", "media", "equipment");
const widths = [640, 1280] as const;
const formats = ["webp", "avif"] as const;

async function main() {
const manifest: Array<{
  equipmentSlug: string;
  role: string;
  originalFilename: string;
  originalSha256: string;
  derivatives: string[];
}> = [];

for (const equipment of equipmentSeed) {
  const equipmentOutput = path.join(outputRoot, equipment.slug);
  await mkdir(equipmentOutput, { recursive: true });

  for (const photo of equipment.photos) {
    const sourcePath = path.join(sourceRoot, photo.filename);
    const sourceBytes = await readFile(sourcePath);
    const originalSha256 = createHash("sha256").update(sourceBytes).digest("hex");
    const derivatives: string[] = [];

    for (const width of widths) {
      for (const format of formats) {
        const relativeStem = mediaStem(equipment.slug, photo.filename);
        const relativePath = `${relativeStem}-${width}.${format}`;
        const outputPath = path.join(projectRoot, "public", relativePath);
        const pipeline = sharp(sourceBytes)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .withMetadata({ orientation: 1 });

        if (format === "webp") {
          await pipeline.webp({ quality: 80, effort: 5 }).toFile(outputPath);
        } else {
          await pipeline.avif({ quality: 58, effort: 5 }).toFile(outputPath);
        }

        derivatives.push(relativePath);
      }
    }

    const after = await stat(sourcePath);
    if (after.size !== sourceBytes.byteLength) {
      throw new Error(`Original photo changed while processing: ${photo.filename}`);
    }

    manifest.push({
      equipmentSlug: equipment.slug,
      role: photo.role,
      originalFilename: photo.filename,
      originalSha256,
      derivatives,
    });
  }
}

await mkdir(outputRoot, { recursive: true });
await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), items: manifest }, null, 2)}\n`,
  "utf8",
);

console.log(`Processed ${manifest.length} verified photos into ${manifest.length * widths.length * formats.length} derivatives.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
