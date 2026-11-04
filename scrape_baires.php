<?php
require_once __DIR__ . '/config/database.php';
$pdo = getDBConnection();

$brands = [
    'Fawna' => 'https://baires-sa.com.ar/productos/fawna/4',
    'Old Prince' => 'https://baires-sa.com.ar/productos/old-prince/15',
    'Kongo' => 'https://baires-sa.com.ar/productos/kongo/2',
    'Maintenance Criadores' => 'https://baires-sa.com.ar/productos/maintenance-criadores/7'
];

$ctx = stream_context_create([
    'http' => [
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nAccept-Charset: UTF-8, ISO-8859-1\r\n",
        'timeout' => 15
    ]
]);

$baseImg = 'https://baires-sa.com.ar/img_productos/';

$allScraped = [];

foreach ($brands as $brand => $url) {
    echo "=== Fetching $brand ($url) ===\n";
    $html = @file_get_contents($url, false, $ctx);
    if (!$html) {
        echo "Failed to fetch $url\n";
        continue;
    }
    
    // convert encoding if needed
    if (!mb_check_encoding($html, 'UTF-8')) {
        $html = mb_convert_encoding($html, 'UTF-8', 'ISO-8859-1');
    }
    
    $dom = new DOMDocument();
    @$dom->loadHTML('<?xml encoding="UTF-8">' . $html);
    $xpath = new DOMXPath($dom);
    
    // Find all item-producto elements
    $nodes = $xpath->query("//div[contains(@class, 'item-producto')]");
    echo "Found " . $nodes->length . " items for $brand\n";
    
    foreach ($nodes as $node) {
        $titleNode = $xpath->query(".//h2 | .//h3", $node)->item(0);
        $title = $titleNode ? trim($titleNode->textContent) : '';
        
        // Find all images
        $imgNodes = $xpath->query(".//img", $node);
        $imgs = [];
        foreach ($imgNodes as $img) {
            $src = $img->getAttribute('src');
            if ($src && !str_contains($src, 'icono-')) {
                $filename = basename($src);
                $imgs[] = $filename;
            }
        }
        
        // Identify bag image and detail/secondary image
        $bagImg = null;
        $detailImg = null;
        
        foreach ($imgs as $fn) {
            if (str_contains($fn, 'Presentaciones')) continue;
            
            // Typical secondary detail image identifiers in Baires S.A.:
            // CCFawna...jpg, CC...png, TABLANUTRICIONAL.jpg, 04...jpg, etc.
            if (str_starts_with($fn, 'CC') || str_contains($fn, 'TABLA') || str_contains($fn, 'TABLANUTRICIONAL') || str_contains($fn, 'NUTRI') || preg_match('/^04\d+.*\.jpg$/i', $fn)) {
                if (!$detailImg) $detailImg = $baseImg . $fn;
            } elseif (str_ends_with(strtolower($fn), '.png') && !str_contains($fn, 'TABLA') && !str_contains($fn, 'Presentacion')) {
                if (!$bagImg) $bagImg = $baseImg . $fn;
            }
        }
        
        // If not found, use first and second
        if (!$bagImg && count($imgs) > 0) {
            $bagImg = $baseImg . $imgs[0];
        }
        if (!$detailImg && count($imgs) > 1) {
            foreach ($imgs as $fn) {
                if ($baseImg . $fn !== $bagImg && !str_contains($fn, 'Presentaciones')) {
                    $detailImg = $baseImg . $fn;
                    break;
                }
            }
        }
        
        if ($title) {
            $allScraped[] = [
                'brand' => $brand,
                'title' => $title,
                'bag_img' => $bagImg,
                'detail_img' => $detailImg,
                'raw_imgs' => $imgs
            ];
            echo "  Item: $title\n";
            echo "    Bag: $bagImg\n";
            echo "    Detail: $detailImg\n";
        }
    }
}

echo "\nTotal items processed: " . count($allScraped) . "\n";

// Now match and update products in MySQL
echo "\n--- Updating MySQL Database ---\n";
$updatedCount = 0;

$stmtUpdate = $pdo->prepare("UPDATE products SET secondary_image_url = :sec WHERE id = :id");

foreach ($allScraped as $sc) {
    if (!$sc['detail_img']) continue;
    
    // 1. Try matching by image_url filename
    $bagFilename = $sc['bag_img'] ? basename($sc['bag_img']) : '';
    $matchedProduct = null;
    
    if ($bagFilename) {
        $stmt = $pdo->prepare("SELECT id, name, image_url, secondary_image_url FROM products WHERE image_url LIKE :fn");
        $stmt->execute(['fn' => "%$bagFilename%"]);
        $matchedProduct = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    // 2. If not matched, try matching by product name similarity
    if (!$matchedProduct) {
        $cleanTitle = trim(preg_replace('/\s+/', ' ', $sc['title']));
        $stmt = $pdo->prepare("SELECT id, name, image_url, secondary_image_url FROM products WHERE brand = :b AND (name LIKE :t1 OR :t2 LIKE CONCAT('%', name, '%'))");
        $stmt->execute([
            'b' => $sc['brand'],
            't1' => "%$cleanTitle%",
            't2' => $cleanTitle
        ]);
        $matchedProduct = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    if ($matchedProduct) {
        $stmtUpdate->execute([
            'sec' => $sc['detail_img'],
            'id' => $matchedProduct['id']
        ]);
        echo "MATCHED [ID {$matchedProduct['id']}]: {$matchedProduct['name']} => {$sc['detail_img']}\n";
        $updatedCount++;
    } else {
        echo "UNMATCHED: {$sc['brand']} - {$sc['title']}\n";
    }
}

echo "\nSuccessfully updated $updatedCount products with secondary images!\n";
