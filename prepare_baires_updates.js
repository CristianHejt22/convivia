// prepare_baires_updates.js
const fs = require('fs');
const { createDescription } = require('./generate_baires_descriptions.js');

async function main() {
  const scraped = JSON.parse(fs.readFileSync('d:\\ptshop\\baires_scraped_full.json', 'utf8'));
  const res = await fetch('http://localhost:8000/api/products.php');
  const d = await res.json();
  const brands = ['Fawna', 'Kongo', 'Old Prince', 'Maintenance Criadores'];
  const dbProducts = d.products.filter(p => brands.includes(p.brand));

  function clean(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const updates = [];

  for (const dbP of dbProducts) {
    let best = null;
    let bestScore = -999;

    for (const sc of scraped) {
      if (sc.brand.toLowerCase() !== dbP.brand.toLowerCase()) continue;
      if (sc.animal !== dbP.animal) continue;

      const dbClean = clean(dbP.name);
      const scClean = clean(sc.title);

      let score = 0;

      // Check Gold
      if (dbClean.includes('gold') === scClean.includes('gold')) score += 10;
      else score -= 20;

      // Check Puppy/Cachorro/Kitten/Gatito
      const isDbBaby = dbClean.includes('cachorro') || dbClean.includes('puppy') || dbClean.includes('gatito') || dbClean.includes('kitten');
      const isScBaby = scClean.includes('cachorro') || scClean.includes('puppy') || scClean.includes('gatito') || scClean.includes('kitten');
      if (isDbBaby === isScBaby) score += 10;
      else score -= 30;

      // Check Senior
      const isDbSenior = dbClean.includes('senior');
      const isScSenior = scClean.includes('senior');
      if (isDbSenior === isScSenior) score += 10;
      else score -= 25;

      // Check Light / Peso
      const isDbLight = dbClean.includes('light') || dbClean.includes('peso');
      const isScLight = scClean.includes('light') || scClean.includes('peso');
      if (isDbLight === isScLight) score += 10;
      else score -= 25;

      // Check Urinario
      const isDbUri = dbClean.includes('urinario');
      const isScUri = scClean.includes('urinario');
      if (isDbUri === isScUri) score += 10;
      else score -= 25;

      // Check Esterilizado / Castrado / Sterilized
      const isDbEst = dbClean.includes('esterilizado') || dbClean.includes('castrado') || dbClean.includes('sterilized');
      const isScEst = scClean.includes('esterilizado') || scClean.includes('castrado') || scClean.includes('sterilized');
      if (isDbEst === isScEst) score += 10;
      else score -= 25;

      // Check Pequeño / Small
      const isDbSmall = dbClean.includes('pequen') || dbClean.includes('small');
      const isScSmall = scClean.includes('pequen') || scClean.includes('small');
      if (isDbSmall === isScSmall) score += 8;
      else score -= 15;

      // Check Mediano / Grande / Large
      const isDbLarge = dbClean.includes('mediano') || dbClean.includes('grande') || dbClean.includes('large');
      const isScLarge = scClean.includes('mediano') || scClean.includes('grande') || scClean.includes('large');
      if (isDbLarge === isScLarge) score += 6;
      else score -= 10;

      // Check Noveles / Equilibrium / Premium
      if (dbClean.includes('noveles') && scClean.includes('noveles')) score += 20;
      if (dbClean.includes('noveles') && !scClean.includes('noveles')) score -= 20;

      if (dbClean.includes('equilibrium') && scClean.includes('equilibrium')) score += 20;
      if (dbClean.includes('equilibrium') && !scClean.includes('equilibrium')) score -= 20;

      if (dbClean.includes('premium') && scClean.includes('premium')) score += 20;
      if (dbClean.includes('premium') && !scClean.includes('premium')) score -= 20;

      // Check protein type: lamb / cordero vs swine / cerdo
      const isDbLamb = dbClean.includes('cordero') || dbClean.includes('lamb');
      const isScLamb = scClean.includes('cordero') || scClean.includes('lamb');
      if (isDbLamb && isScLamb) score += 15;
      if (isDbLamb && !isScLamb) score -= 15;

      const isDbSwine = dbClean.includes('cerdo') || dbClean.includes('swine');
      const isScSwine = scClean.includes('cerdo') || scClean.includes('swine');
      if (isDbSwine && isScSwine) score += 15;
      if (isDbSwine && !isScSwine) score -= 15;

      // Word matching
      const dbWords = dbClean.split(' ');
      const scWords = scClean.split(' ');
      for (const w of dbWords) {
        if (scWords.includes(w)) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        best = sc;
      }
    }

    if (!best) {
      console.error(`ERROR: No match for [#${dbP.id}] ${dbP.name}`);
      continue;
    }

    const fullDescription = createDescription(dbP.brand, dbP.name, dbP.animal, best.ingredients);

    updates.push({
      id: dbP.id,
      name: dbP.name,
      brand: dbP.brand,
      animal: dbP.animal,
      matched_title: best.title,
      description: fullDescription,
      desc_length: fullDescription.length
    });
  }

  console.log(`Generated ${updates.length} updates.`);
  fs.writeFileSync('d:\\ptshop\\baires_updates.json', JSON.stringify(updates, null, 2), 'utf8');
  console.log('Saved to d:\\ptshop\\baires_updates.json');

  // Preview a few
  console.log('\n--- PREVIEW OF 3 ITEMS ---');
  updates.slice(0, 3).forEach(u => {
    console.log(`\n================== [#${u.id}] ${u.name} (${u.brand}) [Len: ${u.desc_length}] ==================`);
    console.log(u.description);
  });
}

main();
