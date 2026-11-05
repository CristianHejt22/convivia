<?php
// api/settings.php - Endpoint para Obtener y Guardar Configuraciones del Panel Admin
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

if ($method === 'GET') {
    $rows = $pdo->query("SELECT setting_key, setting_value FROM settings")->fetchAll();
    $settings = [];
    foreach ($rows as $r) {
        $settings[$r['setting_key']] = $r['setting_value'];
    }

    echo json_encode([
        'status' => 'success',
        'settings' => $settings
    ]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    
    if (empty($input) || !is_array($input)) {
        echo json_encode(['status' => 'error', 'message' => 'Datos no recibidos']);
        exit;
    }

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    
    foreach ($input as $key => $value) {
        $cleanKey = preg_replace('/[^a-zA-Z0-9_-]/', '', $key);
        if (empty($cleanKey)) continue;

        if ($driver === 'sqlite') {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO settings (setting_key, setting_value, updated_at) VALUES (:k, :v, CURRENT_TIMESTAMP)");
        } else {
            $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value, updated_at) 
                                   VALUES (:k, :v, CURRENT_TIMESTAMP) 
                                   ON DUPLICATE KEY UPDATE setting_value = :v2, updated_at = CURRENT_TIMESTAMP");
            $stmt->bindValue(':v2', (string)$value);
        }

        $stmt->bindValue(':k', $cleanKey);
        $stmt->bindValue(':v', (string)$value);
        $stmt->execute();

        // Si se actualizó el porcentaje de descuento o el estado de la oferta general:
        // Sincronizar automáticamente la columna price_promo de los productos en la base de datos
        if ($cleanKey === 'discount_transfer_percent' || $cleanKey === 'discount_transfer_enabled') {
            $rawEnabled = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'discount_transfer_enabled'")->fetchColumn();
            $rawPct = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'discount_transfer_percent'")->fetchColumn();
            $pct = ($rawPct !== false && $rawPct !== null && $rawPct !== '') ? floatval($rawPct) : 10.0;
            $enabled = ($rawEnabled === '1' || $rawEnabled === 1 || $rawEnabled === true) && $pct > 0;
            
            $genMultiplier = $enabled ? max(0.0, (100 - $pct) / 100) : 1.0;
            
            // 1. Productos con precio preferencial manual directo (NO MODIFICAR por oferta general)
            $pdo->exec("UPDATE products SET price_promo = precio_preferencial WHERE precio_preferencial IS NOT NULL AND precio_preferencial > 0");

            // 2. Productos con porcentaje de descuento individual manual (NO MODIFICAR por oferta general)
            $pdo->exec("UPDATE products SET price_promo = ROUND(price_list * ((100 - discount_percent) / 100), 2) WHERE discount_percent IS NOT NULL AND (precio_preferencial IS NULL OR precio_preferencial = 0)");

            // 3. Productos estándar sin descuento individual (heredan el general si está activado y > 0)
            $stmtUpdateGen = $pdo->prepare("UPDATE products SET price_promo = ROUND(price_list * :multiplier, 2) WHERE discount_percent IS NULL AND (precio_preferencial IS NULL OR precio_preferencial = 0)");
            $stmtUpdateGen->execute(['multiplier' => $genMultiplier]);
        }
    }

    // Sincronizar todos los espejos (settings.json, products.json, SQLite y SQL)
    syncAllDataMirrors($pdo);

    echo json_encode([
        'status' => 'success',
        'message' => 'Configuraciones guardadas y precios promocionales actualizados correctamente'
    ]);
    exit;
}
