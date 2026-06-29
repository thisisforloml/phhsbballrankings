/**
 * Generates production-sized brand assets from source PNGs.
 * Usage: node scripts/generate-brand-assets.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "public", "peach-basket");
const out = join(root, "optimized");

const sources = {
  horizontal: join(root, "logo-horizontal.png"),
  icon: join(root, "icon.png"),
  stacked: join(root, "logo-stacked.png"),
};

async function main() {
  await mkdir(out, { recursive: true });

  await sharp(sources.horizontal)
    .resize(640, 214, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(join(out, "logo-horizontal.webp"));

  await sharp(sources.horizontal)
    .resize(320, 107, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(join(out, "logo-horizontal-sm.webp"));

  await sharp(sources.icon)
    .resize(192, 192, { fit: "cover" })
    .webp({ quality: 85 })
    .toFile(join(out, "icon-192.webp"));

  await sharp(sources.icon)
    .resize(32, 32, { fit: "cover" })
    .png()
    .toFile(join(out, "icon-32.png"));

  await sharp(sources.icon)
    .resize(32, 32, { fit: "cover" })
    .toFile(join(out, "favicon.ico"));

  await sharp(sources.stacked)
    .resize(180, 180, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(join(out, "apple-touch-icon.png"));

  await sharp(sources.horizontal)
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toFile(join(out, "og-image.webp"));

  console.log("Wrote optimized assets to public/peach-basket/optimized/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
