/**
 * Builds source PNGs in resources/ for @capacitor/assets.
 * Run: node scripts/generate-app-assets.mjs && npm run cap:assets
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "..");
const resourcesDir = join(root, "resources");
const primary = "#1e3a8a";
const accent = "#fbbf24";

const starPath =
  "M512 168 L578 378 L798 378 L622 512 L688 722 L512 588 L336 722 L402 512 L226 378 L446 378 Z";

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="224" fill="${primary}"/>
  <path d="${starPath}" fill="${accent}"/>
</svg>`;

const splashSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="${primary}"/>
  <path d="${starPath}" transform="translate(854 854) scale(2)" fill="${accent}"/>
  <text x="1366" y="1980" text-anchor="middle" font-family="system-ui, Segoe UI, sans-serif" font-size="120" font-weight="700" fill="#ffffff">Future Star</text>
</svg>`;

await mkdir(resourcesDir, { recursive: true });

await sharp(Buffer.from(iconSvg))
  .png()
  .toFile(join(resourcesDir, "icon-only.png"));

await sharp(Buffer.from(splashSvg))
  .png()
  .toFile(join(resourcesDir, "splash.png"));

await writeFile(
  join(resourcesDir, "README.md"),
  `# App icon & splash sources

- \`icon-only.png\` — 1024×1024 app icon
- \`splash.png\` — 2732×2732 splash screen

Regenerate native assets:

\`\`\`bash
node scripts/generate-app-assets.mjs
npm run cap:assets
npm run cap:sync
\`\`\`

Edit the SVG in \`scripts/generate-app-assets.mjs\` to change branding.
`,
);

console.log("Wrote resources/icon-only.png and resources/splash.png");
