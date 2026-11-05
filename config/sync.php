<?php
// config/sync.php - Motor Centralizado de Sincronización de Datos y Espejos (MySQL <-> SQLite <-> JSON)

require_once __DIR__ . '/database.php';

/**
 * Enriquecer un producto con el cálculo exacto de precios promocionales y preferenciales.
 */
function enrichProductDiscountData(array &$p, bool $generalEnabled, float $generalPercent): void {
    $p['price_list'] = isset($p['price_list']) ? floatval($p['price_list']) : 0.0;
    $p['weight_kg'] = isset($p['weight_kg']) ? floatval($p['weight_kg']) : 0.0;

    // 1. Detectar si el producto tiene descuento o precio preferencial individual configurado manualmente en panel
    $hasManualPref = isset($p['precio_preferencial']) && $p['precio_preferencial'] !== null && $p['precio_preferencial'] !== '' && floatval($p['precio_preferencial']) > 0;
    $hasManualDisc = isset($p['discount_percent']) && $p['discount_percent'] !== null && $p['discount_percent'] !== '';

    if ($hasManualPref && floatval($p['precio_preferencial']) < $p['price_list']) {
        // Oferta individual con precio fijo manual
        $p['precio_preferencial'] = floatval($p['precio_preferencial']);
        $p['has_preferential_price'] = true;
        $p['has_custom_discount'] = true;
        $p['price_promo'] = $p['precio_preferencial'];
        $p['savings'] = round($p['price_list'] - $p['price_promo'], 2);
        $p['savings_percent'] = ($p['price_list'] > 0) ? round(($p['savings'] / $p['price_list']) * 100, 1) : 0.0;
        $p['custom_discount_percent'] = $p['savings_percent'];
    } elseif ($hasManualDisc && floatval($p['discount_percent']) > 0) {
        // Oferta individual con porcentaje manual
        $effectiveDiscount = max(0.0, min(100.0, floatval($p['discount_percent'])));
        $p['has_custom_discount'] = true;
        $p['custom_discount_percent'] = $effectiveDiscount;
        $p['has_preferential_price'] = false;
        $p['precio_preferencial'] = null;
        $multiplier = (100.0 - $effectiveDiscount) / 100.0;
        $p['price_promo'] = round($p['price_list'] * $multiplier, 2);
        $p['savings'] = round($p['price_list'] - $p['price_promo'], 2);
        $p['savings_percent'] = $effectiveDiscount;
    } elseif ($hasManualDisc && floatval($p['discount_percent']) == 0) {
        // Configurado explícitamente sin descuento individual (0%)
        $p['has_custom_discount'] = true;
        $p['custom_discount_percent'] = 0.0;
        $p['has_preferential_price'] = false;
        $p['precio_preferencial'] = null;
        $p['price_promo'] = $p['price_list'];
        $p['savings'] = 0.0;
        $p['savings_percent'] = 0.0;
    } else {
        // Producto estándar que hereda la oferta general (SOLO si generalEnabled está activo y porcentaje > 0)
        $p['has_custom_discount'] = false;
        $p['custom_discount_percent'] = null;
        $p['has_preferential_price'] = false;
        $p['precio_preferencial'] = null;

        $effectiveDiscount = ($generalEnabled && $generalPercent > 0) ? max(0.0, min(100.0, $generalPercent)) : 0.0;
        $multiplier = (100.0 - $effectiveDiscount) / 100.0;

        $p['price_promo'] = round($p['price_list'] * $multiplier, 2);
        $p['savings'] = round($p['price_list'] - $p['price_promo'], 2);
        $p['savings_percent'] = $effectiveDiscount;
    }

    $p['price_per_kg_promo'] = round($p['price_promo'] / max($p['weight_kg'], 1), 2);
    $p['price_per_kg_list'] = round($p['price_list'] / max($p['weight_kg'], 1), 2);

    $p['destacado_mes'] = !empty($p['destacado_mes']) ? 1 : 0;
    $p['pack_funcional'] = !empty($p['pack_funcional']) ? 1 : 0;
    $p['beneficio_exclusivo'] = !empty($p['beneficio_exclusivo']) ? trim($p['beneficio_exclusivo']) : null;
}

/**
 * Sincroniza exhaustivamente todos los espejos de datos:
 * 1. Lee todas las configuraciones y productos de la base de datos activa.
 * 2. Si la conexión activa es MySQL, replica los datos a data_petshop.sqlite.
 * 3. Escribe assets/data/settings.json.
 * 4. Escribe assets/data/products.json con precios enriquecidos.
 * 5. Genera dump en database_petshop.sql si estamos en entorno local con MySQL.
 */
function syncAllDataMirrors(PDO $pdo): array {
    $results = [
        'success' => false,
        'products_count' => 0,
        'sqlite_synced' => false,
        'json_synced' => false,
        'sql_synced' => false,
        'error' => null
    ];

    try {
        // 1. Configuraciones
        $settingsRows = $pdo->query("SELECT setting_key, setting_value FROM settings")->fetchAll(PDO::FETCH_KEY_PAIR);
        $rawGenEnabled = $settingsRows['discount_transfer_enabled'] ?? '1';
        $generalPercent = floatval($settingsRows['discount_transfer_percent'] ?? 10);
        $generalEnabled = ($rawGenEnabled === '1' || $rawGenEnabled === 1 || $rawGenEnabled === true) && $generalPercent > 0;

        // 2. Productos
        $stmt = $pdo->query("SELECT * FROM products ORDER BY id DESC");
        $rawProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $results['products_count'] = count($rawProducts);

        // Enriquecer productos para JSON
        $enrichedProducts = [];
        foreach ($rawProducts as $p) {
            enrichProductDiscountData($p, $generalEnabled, $generalPercent);
            $enrichedProducts[] = $p;
        }

        // 3. Escribir JSONs en assets/data/
        $dataDir = __DIR__ . '/../assets/data';
        if (!is_dir($dataDir)) {
            @mkdir($dataDir, 0777, true);
        }

        $settingsPayload = [
            'status' => 'success',
            'updated_at' => date('c'),
            'settings' => $settingsRows
        ];
        @file_put_contents(
            $dataDir . '/settings.json', 
            json_encode($settingsPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        $productsPayload = [
            'status' => 'success',
            'updated_at' => date('c'),
            'count' => count($enrichedProducts),
            'general_discount_enabled' => $generalEnabled,
            'discount_percent' => $generalPercent,
            'products' => $enrichedProducts
        ];
        @file_put_contents(
            $dataDir . '/products.json', 
            json_encode($productsPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
        $results['json_synced'] = true;

        // 4. Si la base de datos activa es MySQL, sincronizar directamente el archivo SQLite data_petshop.sqlite
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver !== 'sqlite') {
            $sqlitePath = __DIR__ . '/../data_petshop.sqlite';
            try {
                $sqPdo = new PDO('sqlite:' . $sqlitePath, null, null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                ]);

                $sqPdo->beginTransaction();
                
                // Sincronizar products
                $sqPdo->exec("DELETE FROM products");
                if (!empty($rawProducts)) {
                    $cols = array_keys($rawProducts[0]);
                    $colList = implode(', ', $cols);
                    $placeholders = ':' . implode(', :', $cols);
                    $insProd = $sqPdo->prepare("INSERT INTO products ($colList) VALUES ($placeholders)");
                    foreach ($rawProducts as $r) {
                        $insProd->execute($r);
                    }
                }

                // Sincronizar settings
                $sqPdo->exec("DELETE FROM settings");
                if (!empty($settingsRows)) {
                    $insSet = $sqPdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (:k, :v)");
                    foreach ($settingsRows as $k => $v) {
                        $insSet->execute(['k' => $k, 'v' => $v]);
                    }
                }

                // Sincronizar pack_items si existe
                try {
                    $packItems = $pdo->query("SELECT * FROM pack_items")->fetchAll(PDO::FETCH_ASSOC);
                    $sqPdo->exec("DELETE FROM pack_items");
                    if (!empty($packItems)) {
                        $piCols = array_keys($packItems[0]);
                        $piColList = implode(', ', $piCols);
                        $piPlaceholders = ':' . implode(', :', $piCols);
                        $insPi = $sqPdo->prepare("INSERT INTO pack_items ($piColList) VALUES ($piPlaceholders)");
                        foreach ($packItems as $pi) {
                            $insPi->execute($pi);
                        }
                    }
                } catch (Exception $ePi) {
                    // pack_items opcional
                }

                $sqPdo->commit();
                $results['sqlite_synced'] = true;
            } catch (Exception $eSq) {
                if (isset($sqPdo) && $sqPdo->inTransaction()) {
                    $sqPdo->rollBack();
                }
                error_log("SQLite mirror sync error: " . $eSq->getMessage());
            }

            // 5. Generar exportación de database_petshop.sql para trazabilidad completa
            try {
                $sqlPath = __DIR__ . '/../database_petshop.sql';
                $sqlDump = "-- CONVIVIA Database Auto-Sync Dump: " . date('Y-m-d H:i:s') . "\n";
                $sqlDump .= "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n";

                // Tabla settings
                $sqlDump .= "DROP TABLE IF EXISTS `settings`;\n";
                $sqlDump .= "CREATE TABLE `settings` (`setting_key` VARCHAR(100) PRIMARY KEY, `setting_value` TEXT, `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP);\n";
                foreach ($settingsRows as $k => $v) {
                    $sqlDump .= "INSERT INTO `settings` VALUES (" . $pdo->quote($k) . ", " . $pdo->quote($v) . ", CURRENT_TIMESTAMP);\n";
                }

                // Tabla products
                $sqlDump .= "\nDROP TABLE IF EXISTS `products`;\n";
                $sqlDump .= "CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `brand` VARCHAR(100) NOT NULL,
  `animal` VARCHAR(50) NOT NULL,
  `life_stage` VARCHAR(50) NOT NULL,
  `breed_size` VARCHAR(50) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `weight_kg` DECIMAL(5,2) NOT NULL,
  `price_list` DECIMAL(10,2) NOT NULL,
  `price_promo` DECIMAL(10,2) NOT NULL,
  `discount_percent` DECIMAL(5,2) NULL DEFAULT NULL,
  `stock` INT NOT NULL DEFAULT 10,
  `image_url` VARCHAR(500) NOT NULL,
  `secondary_image_url` VARCHAR(500) NULL,
  `description` TEXT,
  `is_featured` TINYINT(1) DEFAULT 0,
  `destacado_mes` TINYINT(1) DEFAULT 0,
  `pack_funcional` TINYINT(1) DEFAULT 0,
  `precio_preferencial` DECIMAL(10,2) NULL DEFAULT NULL,
  `beneficio_exclusivo` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);\n";
                foreach ($rawProducts as $p) {
                    $vals = array_map(function($val) use ($pdo) {
                        return $val === null ? 'NULL' : $pdo->quote((string)$val);
                    }, $p);
                    $sqlDump .= "INSERT INTO `products` VALUES (" . implode(', ', $vals) . ");\n";
                }
                @file_put_contents($sqlPath, $sqlDump);
                $results['sql_synced'] = true;
            } catch (Exception $eSql) {
                error_log("SQL dump error: " . $eSql->getMessage());
            }
        } else {
            $results['sqlite_synced'] = true;
        }

        $results['success'] = true;
    } catch (Exception $e) {
        $results['error'] = $e->getMessage();
        error_log("syncAllDataMirrors fatal error: " . $e->getMessage());
    }

    return $results;
}
