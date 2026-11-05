<?php
// api/products.php - Endpoint REST para Catálogo, Filtros y CRUD de Productos con Oferta General e Individual
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/sync.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Obtener estado y porcentaje de descuento general configurado en Admin
$settingsRows = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('discount_transfer_enabled', 'discount_transfer_percent')")->fetchAll(PDO::FETCH_KEY_PAIR);
$rawGenEnabled = $settingsRows['discount_transfer_enabled'] ?? '1';
$generalPercent = floatval($settingsRows['discount_transfer_percent'] ?? 10);
$generalEnabled = ($rawGenEnabled === '1' || $rawGenEnabled === 1 || $rawGenEnabled === true) && $generalPercent > 0;

function enrichProductDiscount(array &$p, bool $generalEnabled, float $generalPercent): void {
    enrichProductDiscountData($p, $generalEnabled, $generalPercent);
}

function syncProductsAndSettingsJson(PDO $pdo): bool {
    $res = syncAllDataMirrors($pdo);
    return !empty($res['success']);
}

if ($method === 'GET') {
    // 0.1 Consulta específica de Destacado del Mes (Plan de Actualización)
    if (isset($_GET['destacado_mes']) && $_GET['destacado_mes'] === '1') {
        $stmt = $pdo->query("SELECT * FROM products WHERE destacado_mes = 1 ORDER BY id DESC LIMIT 1");
        $featuredMonth = $stmt->fetch();
        if (!$featuredMonth) {
            // Fallback al producto con mejor oferta o marcado como is_featured
            $stmtFallback = $pdo->query("SELECT * FROM products WHERE is_featured = 1 ORDER BY price_list DESC LIMIT 1");
            $featuredMonth = $stmtFallback->fetch();
        }
        if ($featuredMonth) {
            enrichProductDiscount($featuredMonth, $generalEnabled, $generalPercent);
        }
        echo json_encode([
            'status' => 'success',
            'product' => $featuredMonth
        ]);
        exit;
    }

    // 0.2 Consulta de Packs Funcionales y Combos (Plan de Actualización)
    if ((isset($_GET['packs']) && $_GET['packs'] === '1') || (isset($_GET['pack_funcional']) && $_GET['pack_funcional'] === '1')) {
        $stmt = $pdo->query("SELECT * FROM products WHERE pack_funcional = 1 ORDER BY id DESC");
        $packs = $stmt->fetchAll();
        foreach ($packs as &$pk) {
            enrichProductDiscount($pk, $generalEnabled, $generalPercent);
            $stmtItems = $pdo->prepare("SELECT pi.id as item_id, pi.product_id, pi.quantity, pr.name, pr.brand, pr.weight_kg, pr.image_url, pr.stock 
                                        FROM pack_items pi 
                                        JOIN products pr ON pr.id = pi.product_id 
                                        WHERE pi.pack_id = :pack_id");
            $stmtItems->execute(['pack_id' => $pk['id']]);
            $pk['items'] = $stmtItems->fetchAll();
        }
        echo json_encode([
            'status' => 'success',
            'count' => count($packs),
            'packs' => $packs
        ]);
        exit;
    }

    // 0.2.1 Consulta de Componentes de un Pack vía GET
    if (isset($_GET['action']) && $_GET['action'] === 'get_pack_items') {
        $packId = intval($_GET['pack_id'] ?? 0);
        if ($packId > 0) {
            $stmt = $pdo->prepare("SELECT pi.id as item_id, pi.product_id, pi.quantity, pr.name, pr.brand, pr.weight_kg, pr.price_list, pr.price_promo, pr.image_url, pr.stock 
                                   FROM pack_items pi 
                                   JOIN products pr ON pr.id = pi.product_id 
                                   WHERE pi.pack_id = :pack_id");
            $stmt->execute(['pack_id' => $packId]);
            $items = $stmt->fetchAll();
            echo json_encode(['status' => 'success', 'items' => $items]);
            exit;
        }
        echo json_encode(['status' => 'error', 'message' => 'pack_id requerido']);
        exit;
    }

    // 0.3 Consulta de Producto Individual por ID o Slug
    if (isset($_GET['id']) || isset($_GET['slug'])) {
        $id = intval($_GET['id'] ?? 0);
        $slug = trim($_GET['slug'] ?? '');

        if ($id > 0) {
            $stmt = $pdo->prepare("SELECT * FROM products WHERE id = :id");
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $pdo->prepare("SELECT * FROM products WHERE slug = :slug");
            $stmt->execute(['slug' => $slug]);
        }
        $product = $stmt->fetch();

        if (!$product) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Producto no encontrado']);
            exit;
        }

        enrichProductDiscount($product, $generalEnabled, $generalPercent);

        // Si es pack_funcional, incluir los ítems que componen el combo
        $packItems = [];
        if (!empty($product['pack_funcional'])) {
            $stmtItems = $pdo->prepare("SELECT pi.id as item_id, pi.product_id, pi.quantity, pr.name, pr.brand, pr.weight_kg, pr.image_url, pr.stock 
                                        FROM pack_items pi 
                                        JOIN products pr ON pr.id = pi.product_id 
                                        WHERE pi.pack_id = :pack_id");
            $stmtItems->execute(['pack_id' => $product['id']]);
            $packItems = $stmtItems->fetchAll();
        }

        // Presentaciones / Variantes de peso: Solo para Nutricare donde coincide el texto y cambia el KG
        $variants = [];
        if (strcasecmp($product['brand'], 'Nutricare') === 0) {
            $baseName = trim(preg_replace('/\s+\d+(\.\d+)?\s*kg$/i', '', $product['name']));
            $stmtNutri = $pdo->prepare("SELECT id, name, slug, weight_kg, price_list, price_promo, discount_percent, stock 
                                        FROM products 
                                        WHERE brand = 'Nutricare' 
                                        ORDER BY weight_kg ASC");
            $stmtNutri->execute();
            $allNutri = $stmtNutri->fetchAll();
            foreach ($allNutri as $nv) {
                $nvBase = trim(preg_replace('/\s+\d+(\.\d+)?\s*kg$/i', '', $nv['name']));
                if (strcasecmp($baseName, $nvBase) === 0) {
                    enrichProductDiscount($nv, $generalEnabled, $generalPercent);
                    $variants[] = $nv;
                }
            }
        }

        // Productos relacionados (misma marca o misma especie/etapa, excluyendo actual)
        $stmtRel = $pdo->prepare("SELECT id, name, slug, brand, animal, life_stage, breed_size, weight_kg, price_list, price_promo, discount_percent, image_url, secondary_image_url 
                                  FROM products 
                                  WHERE id != :id AND (brand = :brand OR animal = :animal) 
                                  ORDER BY (brand = :brand2) DESC, is_featured DESC 
                                  LIMIT 4");
        $stmtRel->execute([
            'id' => $product['id'],
            'brand' => $product['brand'],
            'brand2' => $product['brand'],
            'animal' => $product['animal']
        ]);
        $related = $stmtRel->fetchAll();
        foreach ($related as &$r) {
            enrichProductDiscount($r, $generalEnabled, $generalPercent);
        }

        echo json_encode([
            'status' => 'success',
            'general_discount_enabled' => $generalEnabled,
            'discount_percent' => $generalPercent,
            'product' => $product,
            'pack_items' => $packItems,
            'variants' => $variants,
            'related' => $related
        ]);
        exit;
    }

    $search = trim($_GET['search'] ?? '');
    $animal = trim($_GET['animal'] ?? '');
    $lifeStage = trim($_GET['life_stage'] ?? '');
    $breedSize = trim($_GET['breed_size'] ?? '');
    $brand = trim($_GET['brand'] ?? '');
    $weight = isset($_GET['weight']) && $_GET['weight'] !== '' ? floatval($_GET['weight']) : null;
    $sort = $_GET['sort'] ?? 'featured';

    $where = ["1=1"];
    $params = [];

    if ($search !== '') {
        $where[] = "(name LIKE :search OR brand LIKE :search_b OR description LIKE :search_d)";
        $params['search'] = "%$search%";
        $params['search_b'] = "%$search%";
        $params['search_d'] = "%$search%";
    }

    if ($animal !== '' && $animal !== 'todos') {
        $where[] = "animal = :animal";
        $params['animal'] = $animal;
    }

    if ($lifeStage !== '' && $lifeStage !== 'todos') {
        $where[] = "life_stage = :life_stage";
        $params['life_stage'] = $lifeStage;
    }

    if ($breedSize !== '' && $breedSize !== 'todas') {
        $where[] = "(breed_size = :breed_size OR breed_size = 'todas')";
        $params['breed_size'] = $breedSize;
    }

    if ($brand !== '' && $brand !== 'todas') {
        $where[] = "brand = :brand";
        $params['brand'] = $brand;
    }

    if ($weight !== null && $weight > 0) {
        $where[] = "weight_kg = :weight";
        $params['weight'] = $weight;
    }

    if (isset($_GET['destacados']) && $_GET['destacados'] === '1') {
        $where[] = "(destacado_mes = 1 OR is_featured = 1)";
    }

    if (isset($_GET['precio_preferencial']) && $_GET['precio_preferencial'] === '1') {
        $where[] = "precio_preferencial IS NOT NULL AND precio_preferencial > 0";
    }

    if (isset($_GET['beneficio_exclusivo']) && $_GET['beneficio_exclusivo'] === '1') {
        $where[] = "beneficio_exclusivo IS NOT NULL AND beneficio_exclusivo != ''";
    }

    // Visibilidad de packs/combos: por defecto se excluyen del catálogo general salvo pedido explícito
    $allowPacks = isset($_GET['packs']) || isset($_GET['pack_funcional']) || (isset($_GET['category']) && $_GET['category'] === 'pack_funcional') || (isset($_GET['include_packs']) && $_GET['include_packs'] === '1');
    if (!$allowPacks && !isset($_GET['precio_preferencial']) && !isset($_GET['beneficio_exclusivo'])) {
        $where[] = "(pack_funcional = 0 OR pack_funcional IS NULL) AND brand != 'CONVIVIA Packs'";
    }

    $orderBy = "is_featured DESC, id DESC";
    if ($sort === 'price_asc') {
        $orderBy = "price_promo ASC";
    } elseif ($sort === 'price_desc') {
        $orderBy = "price_promo DESC";
    } elseif ($sort === 'name_asc') {
        $orderBy = "name ASC";
    }

    $sql = "SELECT * FROM products WHERE " . implode(" AND ", $where) . " ORDER BY " . $orderBy;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    foreach ($products as &$p) {
        enrichProductDiscount($p, $generalEnabled, $generalPercent);
    }

    $brands = $pdo->query("SELECT DISTINCT brand FROM products WHERE (pack_funcional = 0 OR pack_funcional IS NULL) AND brand != 'CONVIVIA Packs' ORDER BY brand ASC")->fetchAll(PDO::FETCH_COLUMN);
    $weights = $pdo->query("SELECT DISTINCT weight_kg FROM products WHERE (pack_funcional = 0 OR pack_funcional IS NULL) ORDER BY weight_kg ASC")->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'status' => 'success',
        'count' => count($products),
        'general_discount_enabled' => $generalEnabled,
        'discount_percent' => $generalPercent,
        'products' => $products,
        'facets' => [
            'brands' => $brands,
            'weights' => array_map('floatval', $weights)
        ]
    ]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = $input['action'] ?? '';

    // 1. Actualización rápida de Stock, Precios y Descuento Individual
    if ($action === 'update_stock_price') {
        $productId = intval($input['product_id'] ?? 0);
        $stock = intval($input['stock'] ?? 0);
        $priceList = floatval($input['price_list'] ?? 0);
        
        $hasDisc = array_key_exists('discount_percent', $input) && $input['discount_percent'] !== '' && $input['discount_percent'] !== null;
        $discountPercent = $hasDisc ? floatval($input['discount_percent']) : null;

        // Si tiene precio_preferencial manual fijo y no se especificó un nuevo discount_percent
        $stmtEx = $pdo->prepare("SELECT precio_preferencial FROM products WHERE id = :id");
        $stmtEx->execute(['id' => $productId]);
        $existing = $stmtEx->fetch(PDO::FETCH_ASSOC);
        $prefPrice = $existing ? ($existing['precio_preferencial'] ?? null) : null;

        if ($prefPrice !== null && $prefPrice !== '' && floatval($prefPrice) > 0 && floatval($prefPrice) < $priceList && $discountPercent === null) {
            $pricePromo = round(floatval($prefPrice), 2);
        } else {
            $effDisc = $discountPercent !== null ? $discountPercent : ($generalEnabled ? $generalPercent : 0);
            $pricePromo = round($priceList * ((100 - $effDisc) / 100), 2);
        }

        if ($productId > 0) {
            $stmt = $pdo->prepare("UPDATE products SET stock = :stock, price_list = :plist, price_promo = :ppromo, discount_percent = :dp WHERE id = :id");
            $stmt->execute([
                'stock' => $stock,
                'plist' => $priceList,
                'ppromo' => $pricePromo,
                'dp' => $discountPercent,
                'id' => $productId
            ]);
            syncAllDataMirrors($pdo);
            echo json_encode(['status' => 'success', 'message' => 'Producto actualizado']);
            exit;
        }
    }

    // 2. Modificación rápida directa de Descuento Individual
    if ($action === 'update_individual_discount') {
        $productId = intval($input['product_id'] ?? 0);
        $hasDisc = array_key_exists('discount_percent', $input) && $input['discount_percent'] !== '' && $input['discount_percent'] !== null;
        $discountPercent = $hasDisc ? floatval($input['discount_percent']) : null;

        if ($productId > 0) {
            $stmtList = $pdo->prepare("SELECT price_list FROM products WHERE id = :id");
            $stmtList->execute(['id' => $productId]);
            $pList = floatval($stmtList->fetchColumn());

            $effDisc = $discountPercent !== null ? $discountPercent : ($generalEnabled ? $generalPercent : 0);
            $pricePromo = round($pList * ((100 - $effDisc) / 100), 2);

            $stmt = $pdo->prepare("UPDATE products SET discount_percent = :dp, price_promo = :pp WHERE id = :id");
            $stmt->execute([
                'dp' => $discountPercent,
                'pp' => $pricePromo,
                'id' => $productId
            ]);
            syncAllDataMirrors($pdo);
            echo json_encode(['status' => 'success', 'message' => 'Descuento individual actualizado', 'discount_percent' => $discountPercent, 'price_promo' => $pricePromo]);
            exit;
        }
    }

    // 3. Crear Nuevo Producto
    if ($action === 'create_product') {
        $name = trim($input['name'] ?? '');
        $brand = trim($input['brand'] ?? '');
        $animal = trim($input['animal'] ?? 'perro');
        $lifeStage = trim($input['life_stage'] ?? 'adulto');
        $breedSize = trim($input['breed_size'] ?? 'todas');
        $category = trim($input['category'] ?? 'super_premium');
        $weight = floatval($input['weight_kg'] ?? 15);
        $priceList = floatval($input['price_list'] ?? 0);

        $hasDisc = array_key_exists('discount_percent', $input) && $input['discount_percent'] !== '' && $input['discount_percent'] !== null;
        $discountPercent = $hasDisc ? floatval($input['discount_percent']) : null;
        
        $precioPreferencial = (isset($input['precio_preferencial']) && $input['precio_preferencial'] !== '' && $input['precio_preferencial'] !== null) 
            ? floatval($input['precio_preferencial']) 
            : null;

        if ($precioPreferencial !== null && $precioPreferencial > 0 && $precioPreferencial < $priceList) {
            $pricePromo = $precioPreferencial;
        } else {
            $effDisc = $discountPercent !== null ? $discountPercent : ($generalEnabled ? $generalPercent : 0);
            $pricePromo = round($priceList * ((100 - $effDisc) / 100), 2);
        }

        $stock = intval($input['stock'] ?? 10);
        $imageUrl = trim($input['image_url'] ?? 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80');
        $secondaryImageUrl = trim($input['secondary_image_url'] ?? '');
        $description = trim($input['description'] ?? '');

        // Nuevos campos del plan
        $destacadoMes = !empty($input['destacado_mes']) ? 1 : 0;
        $packFuncional = !empty($input['pack_funcional']) ? 1 : 0;
        $hasPref = array_key_exists('precio_preferencial', $input) && $input['precio_preferencial'] !== '' && $input['precio_preferencial'] !== null;
        $precioPreferencial = $hasPref ? floatval($input['precio_preferencial']) : null;
        $beneficioExclusivo = !empty($input['beneficio_exclusivo']) ? trim($input['beneficio_exclusivo']) : null;

        if (empty($name) || empty($brand)) {
            echo json_encode(['status' => 'error', 'message' => 'Nombre y Marca son obligatorios']);
            exit;
        }

        if ($destacadoMes === 1) {
            $pdo->exec("UPDATE products SET destacado_mes = 0");
        }

        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $name), '-')) . '-' . round($weight) . 'kg';

        $stmt = $pdo->prepare("INSERT INTO products 
            (name, slug, brand, animal, life_stage, breed_size, category, weight_kg, price_list, price_promo, discount_percent, stock, image_url, secondary_image_url, description, is_featured, destacado_mes, pack_funcional, precio_preferencial, beneficio_exclusivo)
            VALUES
            (:name, :slug, :brand, :animal, :life_stage, :breed_size, :category, :weight_kg, :price_list, :price_promo, :discount_percent, :stock, :image_url, :secondary_image_url, :description, 0, :destacado_mes, :pack_funcional, :precio_preferencial, :beneficio_exclusivo)");

        $stmt->execute([
            'name' => $name,
            'slug' => $slug,
            'brand' => $brand,
            'animal' => $animal,
            'life_stage' => $lifeStage,
            'breed_size' => $breedSize,
            'category' => $category,
            'weight_kg' => $weight,
            'price_list' => $priceList,
            'price_promo' => $pricePromo,
            'discount_percent' => $discountPercent,
            'stock' => $stock,
            'image_url' => $imageUrl,
            'secondary_image_url' => $secondaryImageUrl,
            'description' => $description,
            'destacado_mes' => $destacadoMes,
            'pack_funcional' => $packFuncional,
            'precio_preferencial' => $precioPreferencial,
            'beneficio_exclusivo' => $beneficioExclusivo
        ]);

        $newId = $pdo->lastInsertId();

        // Si se enviaron ítems para el pack
        if ($packFuncional && !empty($input['pack_items']) && is_array($input['pack_items'])) {
            $stmtPi = $pdo->prepare("INSERT INTO pack_items (pack_id, product_id, quantity) VALUES (:pack_id, :product_id, :quantity)");
            foreach ($input['pack_items'] as $pi) {
                $pId = intval($pi['product_id'] ?? 0);
                $pQty = max(1, intval($pi['quantity'] ?? 1));
                if ($pId > 0) {
                    $stmtPi->execute(['pack_id' => $newId, 'product_id' => $pId, 'quantity' => $pQty]);
                }
            }
        }

        syncAllDataMirrors($pdo);
        echo json_encode(['status' => 'success', 'message' => '¡Nuevo producto agregado al catálogo!', 'id' => $newId]);
        exit;
    }

    // 4. Edición Completa de Producto Existente
    if ($action === 'edit_product') {
        $id = intval($input['id'] ?? 0);
        $name = trim($input['name'] ?? '');
        $brand = trim($input['brand'] ?? '');
        $animal = trim($input['animal'] ?? 'perro');
        $lifeStage = trim($input['life_stage'] ?? 'adulto');
        $breedSize = trim($input['breed_size'] ?? 'todas');
        $category = trim($input['category'] ?? 'super_premium');
        $weight = floatval($input['weight_kg'] ?? 15);
        $priceList = floatval($input['price_list'] ?? 0);

        $hasDisc = array_key_exists('discount_percent', $input) && $input['discount_percent'] !== '' && $input['discount_percent'] !== null;
        $discountPercent = $hasDisc ? floatval($input['discount_percent']) : null;
        
        $precioPreferencial = (isset($input['precio_preferencial']) && $input['precio_preferencial'] !== '' && $input['precio_preferencial'] !== null) 
            ? floatval($input['precio_preferencial']) 
            : null;

        if ($precioPreferencial !== null && $precioPreferencial > 0 && $precioPreferencial < $priceList) {
            $pricePromo = $precioPreferencial;
        } else {
            $effDisc = $discountPercent !== null ? $discountPercent : ($generalEnabled ? $generalPercent : 0);
            $pricePromo = round($priceList * ((100 - $effDisc) / 100), 2);
        }

        $stock = intval($input['stock'] ?? 10);
        $imageUrl = trim($input['image_url'] ?? '');
        $secondaryImageUrl = trim($input['secondary_image_url'] ?? '');
        $description = trim($input['description'] ?? '');

        // Nuevos campos del plan
        $destacadoMes = !empty($input['destacado_mes']) ? 1 : 0;
        $packFuncional = !empty($input['pack_funcional']) ? 1 : 0;
        $hasPref = array_key_exists('precio_preferencial', $input) && $input['precio_preferencial'] !== '' && $input['precio_preferencial'] !== null;
        $precioPreferencial = $hasPref ? floatval($input['precio_preferencial']) : null;
        $beneficioExclusivo = !empty($input['beneficio_exclusivo']) ? trim($input['beneficio_exclusivo']) : null;

        if ($id <= 0 || empty($name)) {
            echo json_encode(['status' => 'error', 'message' => 'Datos incompletos para actualizar']);
            exit;
        }

        if ($destacadoMes === 1) {
            $pdo->prepare("UPDATE products SET destacado_mes = 0 WHERE id != :id")->execute(['id' => $id]);
        }

        $stmt = $pdo->prepare("UPDATE products SET 
            name = :name, brand = :brand, animal = :animal, life_stage = :life_stage,
            breed_size = :breed_size, category = :category, weight_kg = :weight_kg,
            price_list = :price_list, price_promo = :price_promo, discount_percent = :discount_percent, stock = :stock,
            image_url = :image_url, secondary_image_url = :secondary_image_url, description = :description,
            destacado_mes = :destacado_mes, pack_funcional = :pack_funcional, precio_preferencial = :precio_preferencial, beneficio_exclusivo = :beneficio_exclusivo
            WHERE id = :id");

        $stmt->execute([
            'name' => $name,
            'brand' => $brand,
            'animal' => $animal,
            'life_stage' => $lifeStage,
            'breed_size' => $breedSize,
            'category' => $category,
            'weight_kg' => $weight,
            'price_list' => $priceList,
            'price_promo' => $pricePromo,
            'discount_percent' => $discountPercent,
            'stock' => $stock,
            'image_url' => $imageUrl,
            'secondary_image_url' => $secondaryImageUrl,
            'description' => $description,
            'destacado_mes' => $destacadoMes,
            'pack_funcional' => $packFuncional,
            'precio_preferencial' => $precioPreferencial,
            'beneficio_exclusivo' => $beneficioExclusivo,
            'id' => $id
        ]);

        // Si se enviaron ítems para el pack
        if (isset($input['pack_items']) && is_array($input['pack_items'])) {
            $pdo->prepare("DELETE FROM pack_items WHERE pack_id = :pack_id")->execute(['pack_id' => $id]);
            if ($packFuncional) {
                $stmtPi = $pdo->prepare("INSERT INTO pack_items (pack_id, product_id, quantity) VALUES (:pack_id, :product_id, :quantity)");
                foreach ($input['pack_items'] as $pi) {
                    $pId = intval($pi['product_id'] ?? 0);
                    $pQty = max(1, intval($pi['quantity'] ?? 1));
                    if ($pId > 0) {
                        $stmtPi->execute(['pack_id' => $id, 'product_id' => $pId, 'quantity' => $pQty]);
                    }
                }
            }
        }

        syncAllDataMirrors($pdo);
        echo json_encode(['status' => 'success', 'message' => 'Producto actualizado exitosamente']);
        exit;
    }

    // 4.1 Toggle Asíncrono Rápido de Flags (Destacado del Mes, Pack Funcional, is_featured)
    if ($action === 'toggle_flag') {
        $productId = intval($input['product_id'] ?? 0);
        $flag = trim($input['flag'] ?? '');
        $allowedFlags = ['destacado_mes', 'pack_funcional', 'is_featured'];

        if ($productId > 0 && in_array($flag, $allowedFlags)) {
            $stmtCurr = $pdo->prepare("SELECT `$flag` FROM products WHERE id = :id");
            $stmtCurr->execute(['id' => $productId]);
            $currentVal = intval($stmtCurr->fetchColumn());
            $newVal = array_key_exists('value', $input) ? (intval($input['value']) ? 1 : 0) : ($currentVal ? 0 : 1);

            if ($flag === 'destacado_mes' && $newVal === 1) {
                $pdo->exec("UPDATE products SET destacado_mes = 0");
            }

            $stmtUp = $pdo->prepare("UPDATE products SET `$flag` = :val WHERE id = :id");
            $stmtUp->execute(['val' => $newVal, 'id' => $productId]);

            syncAllDataMirrors($pdo);
            echo json_encode([
                'status' => 'success',
                'message' => "Flag {$flag} actualizado",
                'flag' => $flag,
                'value' => $newVal,
                'product_id' => $productId
            ]);
            exit;
        }
    }

    // 4.2 Actualización Rápida de Promoción Especial (Precio Preferencial y Beneficio Exclusivo)
    if ($action === 'update_product_special') {
        $productId = intval($input['product_id'] ?? 0);
        $destacadoMes = !empty($input['destacado_mes']) ? 1 : 0;
        $packFuncional = !empty($input['pack_funcional']) ? 1 : 0;

        $hasPref = array_key_exists('precio_preferencial', $input) && $input['precio_preferencial'] !== '' && $input['precio_preferencial'] !== null;
        $precioPreferencial = $hasPref ? floatval($input['precio_preferencial']) : null;
        $beneficioExclusivo = !empty($input['beneficio_exclusivo']) ? trim($input['beneficio_exclusivo']) : null;

        if ($productId > 0) {
            if ($destacadoMes === 1) {
                $pdo->prepare("UPDATE products SET destacado_mes = 0 WHERE id != :id")->execute(['id' => $productId]);
            }

            // Sincronizar price_promo si se configuró precio preferencial individual
            $stmtProd = $pdo->prepare("SELECT price_list, discount_percent FROM products WHERE id = :id");
            $stmtProd->execute(['id' => $productId]);
            $currentProd = $stmtProd->fetch(PDO::FETCH_ASSOC);
            $currPlist = floatval($currentProd['price_list'] ?? 0);
            $currDisc = $currentProd ? $currentProd['discount_percent'] : null;

            if ($precioPreferencial !== null && $precioPreferencial > 0 && $precioPreferencial < $currPlist) {
                $newPricePromo = $precioPreferencial;
            } else {
                $effDisc = ($currDisc !== null && $currDisc !== '') ? floatval($currDisc) : ($generalEnabled ? $generalPercent : 0);
                $newPricePromo = round($currPlist * ((100 - $effDisc) / 100), 2);
            }

            $stmt = $pdo->prepare("UPDATE products SET 
                destacado_mes = :dm, 
                pack_funcional = :pf, 
                precio_preferencial = :pp, 
                price_promo = :price_promo,
                beneficio_exclusivo = :be 
                WHERE id = :id");
            $stmt->execute([
                'dm' => $destacadoMes,
                'pf' => $packFuncional,
                'pp' => $precioPreferencial,
                'price_promo' => $newPricePromo,
                'be' => $beneficioExclusivo,
                'id' => $productId
            ]);

            syncAllDataMirrors($pdo);
            echo json_encode([
                'status' => 'success',
                'message' => 'Configuración de promoción actualizada',
                'product_id' => $productId
            ]);
            exit;
        }
    }

    // 4.3 Submódulo de Gestión de Ítems de Packs Funcionales
    if ($action === 'get_pack_items') {
        $packId = intval($input['pack_id'] ?? $_GET['pack_id'] ?? 0);
        if ($packId > 0) {
            $stmt = $pdo->prepare("SELECT pi.id as item_id, pi.product_id, pi.quantity, pr.name, pr.brand, pr.weight_kg, pr.price_list, pr.price_promo, pr.image_url, pr.stock 
                                   FROM pack_items pi 
                                   JOIN products pr ON pr.id = pi.product_id 
                                   WHERE pi.pack_id = :pack_id");
            $stmt->execute(['pack_id' => $packId]);
            $items = $stmt->fetchAll();
            echo json_encode(['status' => 'success', 'items' => $items]);
            exit;
        }
    }

    if ($action === 'save_pack_items') {
        $packId = intval($input['pack_id'] ?? 0);
        $items = $input['items'] ?? [];
        if ($packId > 0 && is_array($items)) {
            $pdo->prepare("DELETE FROM pack_items WHERE pack_id = :pack_id")->execute(['pack_id' => $packId]);
            $stmtPi = $pdo->prepare("INSERT INTO pack_items (pack_id, product_id, quantity) VALUES (:pack_id, :product_id, :quantity)");
            foreach ($items as $it) {
                $pId = intval($it['product_id'] ?? 0);
                $pQty = max(1, intval($it['quantity'] ?? 1));
                if ($pId > 0) {
                    $stmtPi->execute(['pack_id' => $packId, 'product_id' => $pId, 'quantity' => $pQty]);
                }
            }
            $pdo->prepare("UPDATE products SET pack_funcional = 1 WHERE id = :id")->execute(['id' => $packId]);
            syncAllDataMirrors($pdo);
            echo json_encode(['status' => 'success', 'message' => 'Ítems del combo guardados']);
            exit;
        }
    }

    // 5. Eliminar Producto
    if ($action === 'delete_product') {
        $id = intval($input['id'] ?? 0);
        if ($id > 0) {
            $stmt = $pdo->prepare("DELETE FROM products WHERE id = :id");
            $stmt->execute(['id' => $id]);
            syncAllDataMirrors($pdo);
            echo json_encode(['status' => 'success', 'message' => 'Producto eliminado del catálogo']);
            exit;
        }
    }

    // 6. Actualización Masiva de Precios, Stock y Descuentos (Bulk Tool)
    if ($action === 'bulk_update') {
        $brand = trim($input['brand'] ?? 'all');
        $animal = trim($input['animal'] ?? 'all');
        $priceMode = trim($input['price_mode'] ?? 'none'); // percent_increase, percent_decrease, fixed_add, set_fixed, none
        $priceValue = floatval($input['price_value'] ?? 0);
        $roundTo = intval($input['round_to'] ?? 0); // 0, 50, 100, 500, 1000

        $stockMode = trim($input['stock_mode'] ?? 'none'); // add, subtract, set_fixed, none
        $stockValue = intval($input['stock_value'] ?? 0);

        $discountMode = trim($input['discount_mode'] ?? 'keep'); // keep, reset_general, set_custom
        $hasDiscVal = isset($input['discount_value']) && $input['discount_value'] !== '' && $input['discount_value'] !== null;
        $discountValue = $hasDiscVal ? floatval($input['discount_value']) : null;

        $where = ["1=1"];
        $params = [];
        if ($brand !== 'all' && !empty($brand)) {
            $where[] = "brand = :brand";
            $params['brand'] = $brand;
        }
        if ($animal !== 'all' && !empty($animal)) {
            $where[] = "animal = :animal";
            $params['animal'] = $animal;
        }

        $whereSql = implode(" AND ", $where);
        $stmt = $pdo->prepare("SELECT id, price_list, stock, discount_percent FROM products WHERE $whereSql");
        $stmt->execute($params);
        $prods = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $updatedCount = 0;
        $updateStmt = $pdo->prepare("UPDATE products SET price_list = :plist, price_promo = :ppromo, stock = :stock, discount_percent = :dp WHERE id = :id");

        foreach ($prods as $p) {
            $newPrice = floatval($p['price_list']);
            $newStock = intval($p['stock']);
            $newDiscount = $p['discount_percent'];

            // Ajuste de Precio
            if ($priceMode === 'percent_increase' && $priceValue > 0) {
                $newPrice = $newPrice * (1.0 + ($priceValue / 100.0));
            } elseif ($priceMode === 'percent_decrease' && $priceValue > 0) {
                $newPrice = $newPrice * (1.0 - ($priceValue / 100.0));
            } elseif ($priceMode === 'fixed_add') {
                $newPrice = $newPrice + $priceValue;
            } elseif ($priceMode === 'set_fixed' && $priceValue > 0) {
                $newPrice = $priceValue;
            }

            if ($roundTo > 0) {
                $newPrice = round($newPrice / $roundTo) * $roundTo;
            } else {
                $newPrice = round($newPrice, 2);
            }
            $newPrice = max(0.0, $newPrice);

            // Ajuste de Stock
            if ($stockMode === 'add') {
                $newStock = max(0, $newStock + $stockValue);
            } elseif ($stockMode === 'subtract') {
                $newStock = max(0, $newStock - $stockValue);
            } elseif ($stockMode === 'set_fixed') {
                $newStock = max(0, $stockValue);
            }

            // Ajuste de Descuento
            if ($discountMode === 'reset_general') {
                $newDiscount = null;
            } elseif ($discountMode === 'set_custom') {
                $newDiscount = $discountValue;
            }

            $prefPrice = $p['precio_preferencial'] ?? null;
            if ($prefPrice !== null && $prefPrice !== '' && floatval($prefPrice) > 0 && floatval($prefPrice) < $newPrice && $newDiscount === null) {
                $newPromo = round(floatval($prefPrice), 2);
            } else {
                $effDisc = $newDiscount !== null ? floatval($newDiscount) : ($generalEnabled ? $generalPercent : 0);
                $effDisc = max(0.0, min(100.0, $effDisc));
                $newPromo = round($newPrice * ((100.0 - $effDisc) / 100.0), 2);
            }

            $updateStmt->execute([
                'plist' => $newPrice,
                'ppromo' => $newPromo,
                'stock' => $newStock,
                'dp' => $newDiscount,
                'id' => $p['id']
            ]);
            $updatedCount++;
        }

        @syncProductsAndSettingsJson($pdo);

        echo json_encode([
            'status' => 'success',
            'message' => "Se actualizaron $updatedCount productos exitosamente.",
            'affected' => $updatedCount
        ]);
        exit;
    }

    // 7. Sincronización Manual de Espejos JSON para Nube / Vercel
    if ($action === 'sync_json') {
        $synced = syncProductsAndSettingsJson($pdo);
        echo json_encode([
            'status' => $synced ? 'success' : 'warning',
            'message' => $synced ? '¡Archivos products.json y settings.json sincronizados en disco!' : 'Aviso: No se pudieron sincronizar los archivos locales.'
        ]);
        exit;
    }

    echo json_encode(['status' => 'error', 'message' => 'Acción no válida']);
    exit;
}
