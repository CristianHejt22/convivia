// scrape_nutricare_test.js
async function run() {
  const res = await fetch('https://nutricarepets.com.ar/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await res.text();
  
  const linkRegex = /href=["'](https?:\/\/nutricarepets\.com\.ar\/[^"']+|\/[^"']+)["']/gi;
  const links = new Set();
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    links.add(m[1]);
  }
  console.log('Homepage Links:');
  console.log(Array.from(links));

  // Find logo
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const imgs = [];
  while ((m = imgRegex.exec(html)) !== null) {
    imgs.push(m[1]);
  }
  console.log('\nSample Images from Home:');
  console.log(imgs.slice(0, 15));
}

run();
