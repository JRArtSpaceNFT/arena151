#!/usr/bin/env node

/**
 * Arena 151 Image Optimization Script
 * 
 * Compresses all PNG images in public/ to WebP format
 * Targets: trainer-results, trainer-specials, arenas, and root images
 * 
 * Usage: node scripts/optimize-images.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Directories to optimize
const TARGET_DIRS = [
  'trainer-results',
  'trainer-specials',
  'arenas',
  'trainer-avatars',
];

// Root images to optimize
const ROOT_IMAGES = [
  'Perfect.png',
  'SICKKKKKKK.png',
  'ttt.png',
  'kanto-map.png',
  'background.png',
  'leaderboard-bg.png',
  'BD1.png',
  'NewBD.png',
  'Charmander_Fuji.png',
  'professor-oak.png',
  'victory-bg.png',
];

let totalOriginalSize = 0;
let totalCompressedSize = 0;
let filesProcessed = 0;

async function optimizeImage(inputPath, outputPath, quality = 80) {
  try {
    const inputStats = fs.statSync(inputPath);
    totalOriginalSize += inputStats.size;

    await sharp(inputPath)
      .webp({ quality, effort: 6 })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);
    totalCompressedSize += outputStats.size;
    filesProcessed++;

    const savings = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);
    console.log(`✓ ${path.basename(inputPath)} → ${path.basename(outputPath)} (${savings}% smaller)`);
  } catch (err) {
    console.error(`✗ Failed to optimize ${inputPath}:`, err.message);
  }
}

async function optimizeDirectory(dirName) {
  const dirPath = path.join(PUBLIC_DIR, dirName);
  
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠ Skipping ${dirName} (not found)`);
    return;
  }

  console.log(`\n📁 Processing ${dirName}/...`);
  
  const files = fs.readdirSync(dirPath);
  const pngFiles = files.filter(f => f.endsWith('.png'));

  for (const file of pngFiles) {
    const inputPath = path.join(dirPath, file);
    const outputPath = inputPath.replace('.png', '.webp');
    await optimizeImage(inputPath, outputPath);
  }
}

async function optimizeRootImages() {
  console.log('\n📁 Processing root images...');
  
  for (const filename of ROOT_IMAGES) {
    const inputPath = path.join(PUBLIC_DIR, filename);
    
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠ Skipping ${filename} (not found)`);
      continue;
    }

    const outputPath = inputPath.replace('.png', '.webp').replace('.jpg', '.webp');
    await optimizeImage(inputPath, outputPath);
  }
}

async function main() {
  console.log('🚀 Arena 151 Image Optimization\n');
  console.log('This will create .webp versions of all PNG images.');
  console.log('Original files will NOT be deleted.\n');

  // Process directories
  for (const dir of TARGET_DIRS) {
    await optimizeDirectory(dir);
  }

  // Process root images
  await optimizeRootImages();

  // Summary
  const totalSavings = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1);
  const mbSaved = ((totalOriginalSize - totalCompressedSize) / 1024 / 1024).toFixed(1);

  console.log('\n✅ OPTIMIZATION COMPLETE\n');
  console.log(`Files processed: ${filesProcessed}`);
  console.log(`Original size: ${(totalOriginalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Compressed size: ${(totalCompressedSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Total savings: ${mbSaved} MB (${totalSavings}%)\n`);
  
  console.log('💡 Next steps:');
  console.log('1. Update components to use .webp files');
  console.log('2. Replace <img> tags with Next.js <Image />');
  console.log('3. Test on dev server: npm run dev');
  console.log('4. Deploy: git add . && git commit -m "Optimize images" && git push\n');
}

main().catch(console.error);
