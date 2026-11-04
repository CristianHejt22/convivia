<?php
// scrape_monami_full.php
require_once __DIR__ . '/config/database.php';
$pdo = getDBConnection();

$sections = [
    ['animal' => 'perro', 'cat' => 'super_premium', 'name' => 'Human Grade Perros', 'url' => 'https://www.monami.com.ar/perros/alimento-adultos-y-cachorros/alimento-human-grande/'],
    ['animal' => 'perro', 'cat' => 'premium', 'name' => 'Alimento Natural', 'url' => 'https://www.monami.com.ar/perros/alimento-adultos-y-cachorros/alimento-natural/'],
    ['animal' => 'perro', 'cat' => 'veterinario', 'name' => 'Alimento Funcional Perros', 'url' => 'https://www.monami.com.ar/perros/alimento-adultos-y-cachorros/alimentos-funcionales-perros/'],
    ['animal' => 'perro', 'cat' => 'premium', 'name' => 'Alimento Balanceado', 'url' => 'https://www.monami.com.ar/perros/alimento-adultos-y-cachorros/feedgrade/'],
    ['animal' => 'perro', 'cat' => 'snacks', 'name' => 'Meat Bites', 'url' => 'https://www.monami.com.ar/perros/snacks-meatsticks/meatbites/'],
    ['animal' => 'perro', 'cat' => 'snacks', 'name' => 'Meat Sticks', 'url' => 'https://www.monami.com.ar/perros/snacks-meatsticks/meatsticks/'],
    ['animal' => 'perro', 'cat' => 'snacks', 'name' => 'Snacks Saludables', 'url' => 'https://www.monami.com.ar/perros/snacks-meatsticks/snacksaludable/'],
    ['animal' => 'perro', 'cat' => 'cuidado_dental', 'name' => 'Dental Sticks', 'url' => 'https://www.monami.com.ar/perros/cuidado-dental1/dentales/'],
    ['animal' => 'perro', 'cat' => 'cuidado_dental', 'name' => 'Collagen Chew', 'url' => 'https://www.monami.com.ar/perros/cuidado-dental1/collagenchewtreat/'],
    ['animal' => 'gato', 'cat' => 'super_premium', 'name' => 'Human Grade Gatos', 'url' => 'https://www.monami.com.ar/gatos/alimento/alimento1/'],
    ['animal' => 'gato', 'cat' => 'veterinario', 'name' => 'Alimento Funcional Gatos', 'url' => 'https://www.monami.com.ar/gatos/alimento/alimentos-funcionales-gato/'],
    ['animal' => 'gato', 'cat' => 'snacks', 'name' => 'Snacks Gatos', 'url' => 'https://www.monami.com.ar/gatos/snack/'],
    ['animal' => 'ambos', 'cat' => 'kits', 'name' => 'Kits & Combos', 'url' => 'https://www.monami.com.ar/kits/']
];

$ctx = stream_context_create([
    'http' => [
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n",
        'timeout' => 20
    ]
]);

echo "1. Discovering Mon Ami product URLs...\n";
$productUrls = [];

foreach ($sections as $sec) {
    $html = @file_get_contents($sec['url'], false, $ctx);
    if (!$html) {
        echo "Failed to load {$sec['name']}\n";
        continue;
    }
    
    preg_match_all('/href="([^"]*\/productos\/[^"]*)"/i', $html, $matches);
    $found = 0;
    foreach ($matches[1] as $href) {
        $clean = strtok($href, '?');
        if (str_ends_with($clean, '/productos/') || str_ends_with($clean, '/productos')) continue;
        if (!str_starts_with($clean, 'http')) {
            $clean = 'https://www.monami.com.ar' . $clean;
        }
        if (!isset($productUrls[$clean])) {
            $productUrls[$clean] = [
                'url' => $clean,
                'animal' => $sec['animal'],
                'category' => $sec['cat'],
                'section_name' => $sec['name']
            ];
            $found++;
        }
    }
    echo "  [{$sec['name']}] Found $found new items (Total unique: " . count($productUrls) . ")\n";
}

echo "\n2. Scraping and importing " . count($productUrls) . " Mon Ami products into MySQL...\n";

$insertStmt = $pdo->prepare("INSERT INTO products 
    (name, slug, brand, animal, life_stage, breed_size, category, weight_kg, price_list, price_promo, stock, image_url, secondary_image_url, description, is_featured)
    VALUES
    (:name, :slug, :brand, :animal, :life_stage, :breed_size, :category, :weight_kg, :price_list, :price_promo, :stock, :image_url, :secondary_image_url, :description, :is_featured)");

$updateStmt = $pdo->prepare("UPDATE products SET
    name = :name, slug = :slug, animal = :animal, life_stage = :life_stage, breed_size = :breed_size,
    category = :category, weight_kg = :weight_kg, price_list = :price_list, price_promo = :price_promo,
    stock = :stock, image_url = :image_url, secondary_image_url = :secondary_image_url, description = :description
    WHERE id = :id");

$importedCount = 0;

foreach ($productUrls as $pUrl => $meta) {
    echo "Processing: $pUrl ...\n";
    $phtml = @file_get_contents($pUrl, false, $ctx);
    if (!$phtml) {
        echo "  Failed to fetch\n";
        continue;
    }
    
    $pdom = new DOMDocument();
    @$pdom->loadHTML('<?xml encoding="UTF-8">' . $phtml);
    $pxpath = new DOMXPath($pdom);
    
    // Extract Title
    $h1Nodes = $pxpath->query("//h1[contains(@class, 'js-product-name')] | //h1");
    $title = '';
    if ($h1Nodes->length > 0) {
        $title = trim($h1Nodes->item(0)->textContent);
    }
    if (empty($title)) {
        // Fallback to title tag
        $titleNodes = $pxpath->query("//title");
        if ($titleNodes->length > 0) {
            $t = trim($titleNodes->item(0)->textContent);
            $title = explode('|', $t)[0];
            $title = explode('-', $title)[0];
            $title = trim($title);
        }
    }
    
    if (empty($title)) {
        echo "  Could not determine title, skipping\n";
        continue;
    }
    
    // Extract Price
    $priceNodes = $pxpath->query("//*[@id='price_display'] | //*[contains(@class, 'js-price-display')]");
    $priceList = 0;
    if ($priceNodes->length > 0) {
        $rawPrice = trim($priceNodes->item(0)->textContent);
        // e.g. "$143.375,59"
        $rawPrice = preg_replace('/[^\d,\.]/', '', $rawPrice);
        // Replace thousand separator dots
        $rawPrice = str_replace('.', '', $rawPrice);
        // Replace comma with dot
        $rawPrice = str_replace(',', '.', $rawPrice);
        $priceList = floatval($rawPrice);
    }
    if ($priceList <= 0) {
        $priceList = 18500.00; // reasonable default for snacks/treats if not parsed
    }
    $pricePromo = round($priceList * 0.85, 2); // 15% OFF transferencia
    
    // Extract Description
    $descNodes = $pxpath->query("//*[contains(@class, 'js-product-description')] | //*[contains(@class, 'user-content')]");
    $description = '';
    if ($descNodes->length > 0) {
        $description = trim($descNodes->item(0)->textContent);
        $description = preg_replace('/\s+/', ' ', $description);
        // Remove "Descripción" heading prefix if present
        $description = preg_replace('/^Descripci[oó]n\s*/i', '', $description);
    }
    
    // Extract Images (Primary & Secondary)
    $imgMatches = [];
    preg_match_all('/\/\/(acdn-us\.mitiendanube\.com\/stores\/006\/071\/448\/products\/[^\s"\'<>]+)/i', $phtml, $rawImgs);
    
    $uniqueImgs = [];
    foreach ($rawImgs[1] as $im) {
        // Prefer 1024-1024 or 640-0 high res, avoid tiny thumbs (50-0, 100-0, 240-0)
        if (str_contains($im, '-50-0') || str_contains($im, '-100-0') || str_contains($im, '-240-0') || str_contains($im, '-320-0')) {
            continue;
        }
        $full = 'https://' . $im;
        if (!in_array($full, $uniqueImgs)) {
            $uniqueImgs[] = $full;
        }
    }
    
    $primaryImg = $uniqueImgs[0] ?? 'https://acdn-us.mitiendanube.com/stores/006/071/448/themes/common/logo-1217919693-1744323462-6f3010d659184644b7923c6eb74735911744323462-320-0.webp';
    $secondaryImg = $uniqueImgs[1] ?? null;
    
    // Extract Weight (kg)
    $weightKg = 1.0;
    if (preg_match('/(\d+(?:[\.,]\d+)?)\s*(?:kg|kilos?)/i', $title, $wm)) {
        $weightKg = floatval(str_replace(',', '.', $wm[1]));
    } elseif (preg_match('/(\d+(?:[\.,]\d+)?)\s*(?:gr|g|gramos?)/i', $title, $wm)) {
        $weightKg = round(floatval(str_replace(',', '.', $wm[1])) / 1000.0, 3);
    } elseif (preg_match('/(\d+(?:[\.,]\d+)?)\s*(?:kg|kilos?)/i', $description, $wm)) {
        $weightKg = floatval(str_replace(',', '.', $wm[1]));
    } elseif (preg_match('/(\d+(?:[\.,]\d+)?)\s*(?:gr|g|gramos?)/i', $description, $wm)) {
        $weightKg = round(floatval(str_replace(',', '.', $wm[1])) / 1000.0, 3);
    }
    if ($weightKg <= 0) $weightKg = 0.5;
    
    // Determine Animal
    $animal = $meta['animal'];
    $lowerTitle = mb_strtolower($title);
    if ($animal === 'ambos') {
        if (str_contains($lowerTitle, 'gato') || str_contains($lowerTitle, 'cat') || str_contains($lowerTitle, 'felin')) {
            $animal = 'gato';
        } else {
            $animal = 'perro';
        }
    }
    
    // Determine Life Stage
    $lifeStage = 'adulto';
    if (str_contains($lowerTitle, 'cachorro') || str_contains($lowerTitle, 'puppy') || str_contains($lowerTitle, 'gatito') || str_contains($lowerTitle, 'kitten')) {
        $lifeStage = 'cachorro';
    } elseif (str_contains($lowerTitle, 'senior') || str_contains($lowerTitle, 'mature')) {
        $lifeStage = 'senior';
    } elseif (str_contains($lowerTitle, 'snack') || str_contains($lowerTitle, 'dental') || str_contains($lowerTitle, 'bites') || str_contains($lowerTitle, 'treat')) {
        $lifeStage = 'todas';
    }
    
    // Determine Breed Size
    $breedSize = 'todas';
    if (str_contains($lowerTitle, 'pequeñ') || str_contains($lowerTitle, 'pequeno') || str_contains($lowerTitle, 'small')) {
        $breedSize = 'pequena';
    } elseif (str_contains($lowerTitle, 'grande') || str_contains($lowerTitle, 'large')) {
        $breedSize = 'grande';
    } elseif (str_contains($lowerTitle, 'med') || str_contains($lowerTitle, 'medium')) {
        $breedSize = 'mediana';
    }
    
    // Slug
    $slug = 'mon-ami-' . strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $title), '-'));
    
    // Check if exists
    $existing = $pdo->prepare("SELECT id FROM products WHERE brand = 'Mon Ami' AND (name = :name OR slug = :slug)");
    $existing->execute(['name' => $title, 'slug' => $slug]);
    $existRow = $existing->fetch(PDO::FETCH_ASSOC);
    
    if ($existRow) {
        $updateStmt->execute([
            'name' => $title,
            'slug' => $slug,
            'animal' => $animal,
            'life_stage' => $lifeStage,
            'breed_size' => $breedSize,
            'category' => $meta['category'],
            'weight_kg' => $weightKg,
            'price_list' => $priceList,
            'price_promo' => $pricePromo,
            'stock' => 15,
            'image_url' => $primaryImg,
            'secondary_image_url' => $secondaryImg,
            'description' => $description,
            'id' => $existRow['id']
        ]);
        echo "  Updated [ID {$existRow['id']}]: $title ($$priceList, {$weightKg}kg)\n";
    } else {
        $insertStmt->execute([
            'name' => $title,
            'slug' => $slug,
            'brand' => 'Mon Ami',
            'animal' => $animal,
            'life_stage' => $lifeStage,
            'breed_size' => $breedSize,
            'category' => $meta['category'],
            'weight_kg' => $weightKg,
            'price_list' => $priceList,
            'price_promo' => $pricePromo,
            'stock' => 15,
            'image_url' => $primaryImg,
            'secondary_image_url' => $secondaryImg,
            'description' => $description,
            'is_featured' => (str_contains($lowerTitle, 'human grade') || str_contains($lowerTitle, 'superfood') || str_contains($lowerTitle, 'kit')) ? 1 : 0
        ]);
        echo "  Inserted [ID " . $pdo->lastInsertId() . "]: $title ($$priceList, {$weightKg}kg)\n";
    }
    $importedCount++;
}

echo "\nSuccessfully processed $importedCount Mon Ami products!\n";
