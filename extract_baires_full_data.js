// extract_baires_full_data.js
const fs = require('fs');

const brandUrls = [
  { brand: 'Fawna', url: 'https://baires-sa.com.ar/productos/fawna/4' },
  { brand: 'Old Prince', url: 'https://baires-sa.com.ar/productos/old-prince/15' },
  { brand: 'Kongo', url: 'https://baires-sa.com.ar/productos/kongo/2' },
  { brand: 'Maintenance Criadores', url: 'https://baires-sa.com.ar/productos/maintenance-criadores/7' }
];

async function run() {
  const allBairesProducts = [];

  for (const b of brandUrls) {
    const res = await fetch(b.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    console.log(`Fetched ${b.brand}: ${html.length} chars`);

    // Match each item-producto
    const itemRegex = /<div class="item-producto"[^>]*data-tipo="([^"]*)"[^>]*>([\s\S]*?)<\/div>\s*<div class="clear"><\/div>/gi;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
      const animalType = match[1]; // 'perro' or 'gato'
      const content = match[2];

      // Title
      const titleMatch = content.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      // Ingredients
      let ingredients = '';
      const ingMatch = content.match(/<h2>Ingredientes<\/h2>\s*<p>([\s\S]*?)<\/p>/i);
      if (ingMatch) {
        ingredients = ingMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      }

      // If no <h2>Ingredientes</h2>, grab second <p>
      if (!ingredients) {
        const ps = [...content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
        if (ps.length >= 2) {
          ingredients = ps[1][1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        } else if (ps.length === 1) {
          ingredients = ps[0][1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }
      }

      // Images
      const imgMatches = [...content.matchAll(/src="([^"]+)"/gi)].map(m => m[1]);
      const base = 'https://baires-sa.com.ar/img_productos/';
      const cleanedImgs = imgMatches.filter(src => !src.includes('icono-')).map(src => {
        const fn = src.split('/').pop();
        return base + fn;
      });

      let bagImg = cleanedImgs.find(im => im.endsWith('.png') && !im.includes('Presentacion') && !im.includes('TABLA')) || cleanedImgs[0] || null;
      let tableImg = cleanedImgs.find(im => im.includes('CC') || im.includes('TABLA') || im.includes('NUTRI') || /04\d+.*\.jpg$/i.test(im)) || null;

      if (title) {
        allBairesProducts.push({
          brand: b.brand,
          title,
          animal: animalType || 'perro',
          ingredients,
          bagImg,
          tableImg,
          allImgs: cleanedImgs
        });
      }
    }
  }

  console.log(`Total Baires scraped products: ${allBairesProducts.length}`);
  fs.writeFileSync('d:\\ptshop\\baires_scraped_full.json', JSON.stringify(allBairesProducts, null, 2), 'utf8');

  allBairesProducts.slice(0, 5).forEach(p => {
    console.log(`\n[${p.brand}] ${p.title} (${p.animal})`);
    console.log(`  Ingredients length: ${p.ingredients.length} chars`);
    console.log(`  Preview: "${p.ingredients.substring(0, 100)}..."`);
    console.log(`  Bag: ${p.bagImg}`);
    console.log(`  Table: ${p.tableImg}`);
  });
}
run();
