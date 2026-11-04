// extract_tables_nutricare.js
const fs = require('fs');

function extractTables(filename, name) {
  const html = fs.readFileSync(filename, 'utf8');
  console.log(`\n========================================`);
  console.log(`=== TABLES IN ${name} ===`);
  console.log(`========================================`);

  // Look for <table> or table-like divs
  const tables = [...html.matchAll(/<table[^>]*>(.*?)<\/table>/gis)].map(m => m[1]);
  console.log('Tables found:', tables.length);

  tables.forEach((t, i) => {
    console.log(`--- Table ${i + 1} ---`);
    const rows = [...t.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)].map(tr => {
      const cells = [...tr[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)].map(td => td[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      return cells.join(' | ');
    });
    console.log(rows.join('\n'));
  });

  // Also check if there are images or divs for tables
  const sections = [...html.matchAll(/elementor-widget-container[^>]*>(.*?)<\/div>/gis)]
    .map(m => m[1])
    .filter(s => s.includes('COMPOSICI') || s.includes('SUMINISTRO') || s.includes('Proteína') || s.includes('Tenor'));
  
  console.log('Sections with nutrition/supply:', sections.length);
  sections.forEach((s, idx) => {
    console.log(`[Section ${idx}]:`, s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300));
  });
}

extractTables('d:\\ptshop\\nutricare_adultos.html', 'PERROS ADULTOS');
extractTables('d:\\ptshop\\nutricare_cachorro.html', 'CACHORRO');
extractTables('d:\\ptshop\\nutricare_gatos.html', 'GATOS ADULTOS');
