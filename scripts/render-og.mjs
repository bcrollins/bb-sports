// Render public/og.svg → public/og.png (1200x630) for social previews.
// Run after changing the OG SVG. Not part of the build (avoids native dep at boot).
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync('public/og.svg');
const png = await sharp(svg, { density: 192 }).resize(1200, 630).png().toBuffer();
writeFileSync('public/og.png', png);
console.log('wrote', png.length, 'bytes to public/og.png');
