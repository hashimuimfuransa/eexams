const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function convertSvgToPng() {
  const svgPath = path.join(__dirname, '../../client/public/og-image.svg');
  const pngPath = path.join(__dirname, '../../client/public/og-image.png');

  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync(svgPath);

    // Convert to PNG using sharp
    await sharp(svgBuffer)
      .resize(1200, 630)
      .png()
      .toFile(pngPath);

    console.log('✓ Successfully converted og-image.svg to og-image.png (1200x630px)');
    console.log(`  Output: ${pngPath}`);
  } catch (error) {
    console.error('Error converting SVG to PNG:', error);
    console.log('Note: Make sure sharp is installed: npm install sharp');
  }
}

// Run the conversion
convertSvgToPng();
