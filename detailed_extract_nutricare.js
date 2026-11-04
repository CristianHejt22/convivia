// detailed_extract_nutricare.js
const fs = require('fs');

function inspectDetails(filename, name) {
  const html = fs.readFileSync(filename, 'utf8');
  console.log(`\n========================================`);
  console.log(`=== ${name} ===`);
  console.log(`========================================`);

  // Find all text blocks in elementor widgets
  const blocks = [...html.matchAll(/class=["'][^"']*(?:elementor-widget-text-editor|elementor-widget-heading|elementor-widget-image)[^"']*["'][^>]*>(.*?)<\/div>/gis)]
    .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 5);

  console.log('--- WIDGET BLOCKS ---');
  blocks.forEach((b, i) => {
    if (b.length > 15) console.log(`[${i}] ${b}`);
  });

  // Find all images with their full URLs
  const imgUrls = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  console.log('\n--- ALL IMAGES ---');
  console.log([...new Set(imgUrls)]);
}

inspectDetails('d:\\ptshop\\nutricare_adultos.html', 'PERROS ADULTOS');
inspectDetails('d:\\ptshop\\nutricare_cachorro.html', 'CACHORRO');
inspectDetails('d:\\ptshop\\nutricare_gatos.html', 'GATOS ADULTOS');
