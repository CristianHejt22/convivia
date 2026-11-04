// map_all_monami.js
const fs = require('fs');

const content = fs.readFileSync('d:\\ptshop\\monami_galleries_dump.txt', 'utf16le');
const blocks = content.split('\nPRODUCT: ').filter(Boolean);

function selectImages(title, imgFilenames) {
  if (!imgFilenames || imgFilenames.length === 0) {
    return { primary: null, secondary: null, note: 'no_images' };
  }

  // 1. SELECT PRIMARY IMAGE (Frente / Bolsa / Packshot principal)
  // Look for '-frente-', '-1-', '-1.', or first position
  let primary = null;
  const frente = imgFilenames.find(im => /-frente-|-front-/i.test(im));
  const dash1 = imgFilenames.find(im => /-\d*k?-1-|-grade-1-|-superfood.*-1-|-alimento.*-1-/i.test(im));
  
  if (frente) {
    primary = frente;
  } else if (dash1) {
    primary = dash1;
  } else {
    // Default to first image
    primary = imgFilenames[0];
  }

  // 2. SELECT SECONDARY IMAGE (Ficha Técnica / Tabla Nutricional)
  // Must NOT be the same as primary!
  const otherImages = imgFilenames.filter(im => im !== primary);
  if (otherImages.length === 0) {
    return { primary, secondary: null, note: 'single_image' };
  }

  let secondary = null;
  let rule = '';

  // Priority 1: Exact 'g-6' or containing 'g-6'
  const g6 = otherImages.find(im => /g-6/i.test(im));
  if (g6) {
    secondary = g6;
    rule = 'g-6 (Ficha Técnica)';
  }

  // Priority 2: Composición centesimal / Tabla nutricional
  if (!secondary) {
    const comp = otherImages.find(im => /comp-centesimal|tabla-nutri|composicion|informacion-nutricional/i.test(im));
    if (comp) {
      secondary = comp;
      rule = 'comp-centesimal (Tabla Nutricional)';
    }
  }

  // Priority 3: Listing enriquecido image 6 (or 7, 8)
  if (!secondary) {
    const le = otherImages.find(im => /listing-enriquecido.*-6-/i.test(im)) ||
               otherImages.find(im => /listing-enriquecido.*-[78]-/i.test(im));
    if (le) {
      secondary = le;
      rule = 'listing-enriquecido-6 (Ficha Técnica)';
    }
  }

  // Priority 4: Suffix '-6-' in product code (e.g. cordero12k-6, pollo-12k-6, feed-grade-6)
  if (!secondary) {
    const dash6 = otherImages.find(im => /-\d*k?-6-|-grade-6-|-superfood.*-6-|-alimento.*-6-/i.test(im));
    if (dash6) {
      secondary = dash6;
      rule = 'dash-6 (Ficha/Reverso)';
    }
  }

  // Priority 5: Dorso / Reverso (for snacks, sticks, pouch backs)
  if (!secondary) {
    const dorso = otherImages.find(im => /-dorso-|-reverso-|-atras-|-back-/i.test(im));
    if (dorso) {
      secondary = dorso;
      rule = 'dorso (Reverso con Información)';
    }
  }

  // Priority 6: Ingredientes or Recomendaciones
  if (!secondary) {
    const ingr = otherImages.find(im => /ingredientes/i.test(im)) ||
                 otherImages.find(im => /recomendaciones/i.test(im)) ||
                 otherImages.find(im => /piramide/i.test(im));
    if (ingr) {
      secondary = ingr;
      rule = 'ingredientes/guía nutricional';
    }
  }

  // Priority 7: Any other '-2-' or last gallery image
  if (!secondary) {
    // If there is an image with '-2-' or '-5-'
    const dash2 = otherImages.find(im => /-2-|-5-/i.test(im));
    if (dash2) {
      secondary = dash2;
      rule = 'galería ángulo 2';
    } else {
      secondary = otherImages[otherImages.length - 1];
      rule = 'galería secundaria';
    }
  }

  return { primary, secondary, note: rule };
}

let countWithSecondary = 0;
let countSingle = 0;

blocks.forEach((b, idx) => {
  const lines = b.trim().split('\n');
  const titleLine = lines[0];
  if (titleLine.startsWith('Total products:')) return;
  const title = titleLine.split(' [')[0];
  const url = (titleLine.match(/\[(.*)\]/) || [])[1] || '';
  const imgLines = lines.slice(2).map(l => l.trim()).filter(Boolean);

  const sel = selectImages(title, imgLines);
  if (sel.secondary) countWithSecondary++;
  else countSingle++;

  console.log(`[${idx}] ${title}`);
  console.log(`    Primary:   ${sel.primary}`);
  console.log(`    Secondary: ${sel.secondary || '--- NINGUNA (Kit o imagen única) ---'} [${sel.note}]`);
});

console.log(`\nResumen: Con Ficha/Secundaria: ${countWithSecondary} | Solos/Kits: ${countSingle}`);
