// parse_nutricare.js
const fs = require('fs');

function cleanHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePage(filename, label) {
  const html = fs.readFileSync(filename, 'utf8');
  console.log(`\n=================== ${label} ===================`);

  // Look for presentations (kg)
  const kgMatches = [...html.matchAll(/(\d+(?:[.,]\d+)?)\s*kg/gi)].map(m => m[0]);
  console.log('Presentations / KG mentions:', [...new Set(kgMatches)]);

  // Look for sections containing "ingredientes", "composicion", "tabla", "analisis", "beneficios", "presentacion"
  const pTags = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 20);
  console.log('Paragraphs count:', pTags.length);
  pTags.forEach((p, idx) => {
    console.log(`[P${idx}]:`, p.substring(0, 150) + (p.length > 150 ? '...' : ''));
  });

  // Images
  const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  console.log('Images:', imgs);
}

parsePage('d:\\ptshop\\nutricare_adultos.html', 'PERROS ADULTOS');
parsePage('d:\\ptshop\\nutricare_cachorro.html', 'CACHORROS');
parsePage('d:\\ptshop\\nutricare_gatos.html', 'GATOS ADULTOS');
