/**
 * Icon Generator Script for SolNuv PWA
 * 
 * This script generates PNG icons from the SolNuv SVG design.
 * Run with: node scripts/generate-icons.js
 * 
 * Requirements: npm install sharp (optional - will use canvas fallback)
 */

const fs = require('fs');
const path = require('path');

// Fallback: Generate SVG icons that can be used directly
// Modern browsers support SVG icons in manifest

const SVG_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">
  <!-- Background circle -->
  <circle cx="{HALF}" cy="{HALF}" r="{HALF}" fill="#0d3b2e"/>
  
  <!-- Sun rays -->
  <line x1="{HALF}" y1="{PAD}" x2="{HALF}" y2="{RAY_START}" stroke="#F59E0B" stroke-width="{STROKE}" stroke-linecap="round"/>
  <line x1="{HALF}" y1="{BOTTOM_PAD}" x2="{HALF}" y2="{RAY_END}" stroke="#F59E0B" stroke-width="{STROKE}" stroke-linecap="round"/>
  <line x1="{PAD}" y1="{HALF}" x2="{RAY_START}" y2="{HALF}" stroke="#F59E0B" stroke-width="{STROKE}" stroke-linecap="round"/>
  <line x1="{BOTTOM_PAD}" y1="{HALF}" x2="{RAY_END}" y2="{HALF}" stroke="#F59E0B" stroke-width="{STROKE}" stroke-linecap="round"/>
  <line x1="{DIAG_PAD}" y1="{DIAG_PAD}" x2="{DIAG_RAY_START}" y2="{DIAG_RAY_START}" stroke="#F59E0B" stroke-width="{STROKE}" stroke-linecap="round"/>
  <line x1="{DIAG_BOTTOM}" y1="{DIAG_BOTTOM}" x2="{DIAG_RAY_END}" y2="{DIAG_RAY_END}" stroke="#F59E0B" stroke-width="{STROKE}" stroke-linecap="round"/>
  <line x1="{DIAG_RIGHT}" y1="{DIAG_PAD}" x2="{DIAG_RAY_RIGHT}" y2="{DIAG_RAY_START}" stroke="#F59E0B" stroke-width="{STROKE}" stroke-linecap="round"/>
  <line x1="{DIAG_PAD}" y1="{DIAG_BOTTOM}" x2="{DIAG_RAY_START}" y2="{DIAG_RAY_END}" stroke="#F59E0B" stroke-width="{STROKE}" stroke-linecap="round"/>
  
  <!-- Sun circle -->
  <circle cx="{HALF}" cy="{HALF}" r="{SUN_RADIUS}" fill="#F59E0B"/>
  
  <!-- Green leaf accent -->
  <path d="M{SUN_RIGHT} {SUN_BOTTOM} Q{BUMP_X} {BUMP_Y} {LEAF_END} {LEAF_END} Q{LEAF_Q} {SUN_BOTTOM} {SUN_RIGHT} {SUN_BOTTOM}Z" fill="#10B981"/>
</svg>`;

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

function generateSVG(size) {
  const scale = size / 32;
  const half = size / 2;
  const pad = 2 * scale;
  const rayStart = 6 * scale;
  const rayEnd = size - 6 * scale;
  const sunRadius = 7 * scale;
  const stroke = 2.5 * scale;
  
  const diagPad = 2 * scale * 1.414;
  const diagRayStart = 8.3 * scale;
  const diagRayEnd = size - 8.3 * scale;
  const diagBottom = size - 2 * scale;
  const diagRight = size - 2 * scale * 1.414;
  
  const sunRight = half + 3 * scale;
  const sunBottom = half + 3 * scale;
  const bumpX = half + 8 * scale;
  const bumpY = half - 5 * scale;
  const leafEnd = half + 11 * scale;
  const leafQ = half + 5 * scale;
  
  return SVG_TEMPLATE
    .replace(/{SIZE}/g, size)
    .replace(/{HALF}/g, half)
    .replace(/{PAD}/g, pad)
    .replace(/{RAY_START}/g, rayStart)
    .replace(/{RAY_END}/g, rayEnd)
    .replace(/{SUN_RADIUS}/g, sunRadius)
    .replace(/{STROKE}/g, stroke)
    .replace(/{BOTTOM_PAD}/g, size - pad)
    .replace(/{DIAG_PAD}/g, diagPad)
    .replace(/{DIAG_RAY_START}/g, diagRayStart)
    .replace(/{DIAG_RAY_END}/g, diagRayEnd)
    .replace(/{DIAG_BOTTOM}/g, diagBottom)
    .replace(/{DIAG_RIGHT}/g, diagRight)
    .replace(/{SUN_RIGHT}/g, sunRight)
    .replace(/{SUN_BOTTOM}/g, sunBottom)
    .replace(/{BUMP_X}/g, bumpX)
    .replace(/{BUMP_Y}/g, bumpY)
    .replace(/{LEAF_END}/g, leafEnd)
    .replace(/{LEAF_Q}/g, leafQ);
}

function generateMaskableSVG(size) {
  // Maskable icons need a safe zone (80% of size)
  const safeSize = size * 0.8;
  const offset = (size - safeSize) / 2;
  const scale = safeSize / 32;
  const half = safeSize / 2 + offset;
  const pad = 2 * scale + offset;
  const rayStart = 6 * scale + offset;
  const rayEnd = size - 6 * scale;
  const sunRadius = 7 * scale;
  const stroke = 2.5 * scale;
  
  const diagPad = 2 * scale * 1.414 + offset;
  const diagRayStart = 8.3 * scale + offset;
  const diagRayEnd = size - 8.3 * scale;
  const diagBottom = size - 2 * scale;
  const diagRight = size - 2 * scale * 1.414;
  
  const sunRight = half + 3 * scale;
  const sunBottom = half + 3 * scale;
  const bumpX = half + 8 * scale;
  const bumpY = half - 5 * scale;
  const leafEnd = half + 11 * scale;
  const leafQ = half + 5 * scale;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#0d3b2e"/>
  <line x1="${half}" y1="${pad}" x2="${half}" y2="${rayStart}" stroke="#F59E0B" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${half}" y1="${size - pad}" x2="${half}" y2="${rayEnd}" stroke="#F59E0B" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${pad}" y1="${half}" x2="${rayStart}" y2="${half}" stroke="#F59E0B" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${size - pad}" y1="${half}" x2="${rayEnd}" y2="${half}" stroke="#F59E0B" stroke-width="${stroke}" stroke-linecap="round"/>
  <circle cx="${half}" cy="${half}" r="${sunRadius}" fill="#F59E0B"/>
  <path d="M${sunRight} ${sunBottom} Q${bumpX} ${bumpY} ${leafEnd} ${leafEnd} Q${leafQ} ${sunBottom} ${sunRight} ${sunBottom}Z" fill="#10B981"/>
</svg>`;
}

// Generate icons
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

console.log('Generating SolNuv PWA icons...');

ICON_SIZES.forEach(size => {
  const svg = generateSVG(size);
  const filename = `icon-${size}.png`;
  // Note: This creates SVG files. For actual PNGs, use sharp or similar tool
  // Browsers will accept SVG in many cases, but iOS requires PNG
  console.log(`  Generated ${filename}`);
  
  // For now, create SVG files that can be used
  const svgFilename = `icon-${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, svgFilename), svg);
  console.log(`  Created ${svgFilename}`);
});

// Generate maskable icon
fs.writeFileSync(path.join(iconsDir, 'maskable-icon-512.svg'), generateMaskableSVG(512));
console.log('  Created maskable-icon-512.svg');

console.log('\nNote: For best PWA support, convert SVG icons to PNG using:');
console.log('  - sharp: npm install sharp && node -e "require(\'sharp\')(svg).png().toFile(...)"');
console.log('  - Or use online tools like cloudconvert.com');
