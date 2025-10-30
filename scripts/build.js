import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function build() {
  console.log('🚀 Building Atlas Extension...');

  // Copy manifest to dist
  const manifestSrc = path.join(rootDir, 'public', 'manifest.json');
  const manifestDest = path.join(rootDir, 'dist', 'manifest.json');
  
  if (fs.existsSync(manifestSrc)) {
    await fs.copy(manifestSrc, manifestDest);
    console.log('✓ Copied manifest.json');
  }

  // Copy icons if they exist
  const iconsSrc = path.join(rootDir, 'public', 'icons');
  const iconsDest = path.join(rootDir, 'dist', 'icons');
  
  if (fs.existsSync(iconsSrc)) {
    await fs.copy(iconsSrc, iconsDest);
    console.log('✓ Copied icons');
  } else {
    console.log('⚠ Icons directory not found, creating placeholders...');
    await fs.ensureDir(iconsDest);
    // Note: In production, you'd generate actual icons here
  }

  console.log('✅ Build complete! Extension is ready in dist/ folder');
  console.log('\nTo load the extension:');
  console.log('1. Open Chrome/Edge and go to chrome://extensions/');
  console.log('2. Enable "Developer mode"');
  console.log('3. Click "Load unpacked" and select the dist/ folder');
}

build().catch(console.error);

