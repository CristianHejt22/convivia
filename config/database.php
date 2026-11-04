<?php
// config/database.php - Conexión de Datos Híbrida (MySQL con fallback a SQLite)
require_once __DIR__ . '/config.php';

function getDBConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dbHost = '127.0.0.1';
    $dbPort = '3306';
    $dbUser = 'root';
    $dbPass = '';
    $dbName = 'petshop_db';

    try {
        $initPdo = new PDO("mysql:host=$dbHost;port=$dbPort;charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 2
        ]);
        $initPdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        
        $pdo = new PDO("mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    } catch (Exception $e) {
        $sqliteFile = __DIR__ . '/../data_petshop.sqlite';
        $pdo = new PDO("sqlite:" . $sqliteFile, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }

    initializeDatabaseTables($pdo);
    return $pdo;
}

function initializeDatabaseTables(PDO $pdo) {
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $autoInc = ($driver === 'sqlite') ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';

    // 1. Tabla de Productos
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (
        id $autoInc,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        animal VARCHAR(50) NOT NULL,
        life_stage VARCHAR(50) NOT NULL,
        breed_size VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,
        weight_kg DECIMAL(5,2) NOT NULL,
        price_list DECIMAL(10,2) NOT NULL,
        price_promo DECIMAL(10,2) NOT NULL,
        discount_percent DECIMAL(5,2) NULL DEFAULT NULL,
        stock INT NOT NULL DEFAULT 10,
        image_url VARCHAR(500) NOT NULL,
        secondary_image_url VARCHAR(500) NULL,
        description TEXT,
        is_featured TINYINT(1) DEFAULT 0,
        destacado_mes TINYINT(1) DEFAULT 0,
        pack_funcional TINYINT(1) DEFAULT 0,
        precio_preferencial DECIMAL(10,2) NULL DEFAULT NULL,
        beneficio_exclusivo VARCHAR(255) NULL DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 1.1 Tabla Relacional de Packs Funcionales y Combos
    $pdo->exec("CREATE TABLE IF NOT EXISTS pack_items (
        id $autoInc,
        pack_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 2. Tabla de Pedidos / Órdenes
    $pdo->exec("CREATE TABLE IF NOT EXISTS orders (
        id $autoInc,
        order_number VARCHAR(50) NOT NULL,
        customer_name VARCHAR(150) NOT NULL,
        customer_whatsapp VARCHAR(50) NOT NULL,
        customer_email VARCHAR(150),
        customer_address TEXT NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        receipt_path VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'pendiente_comprobante',
        pet_name VARCHAR(100),
        pet_weight DECIMAL(5,2),
        estimated_next_order DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 3. Tabla de Ítems del Pedido
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (
        id $autoInc,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        weight_kg DECIMAL(5,2) NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL
    )");

    // 4. Tabla de Notificaciones / Telegram Logs
    $pdo->exec("CREATE TABLE IF NOT EXISTS telegram_notifications (
        id $autoInc,
        order_id INT NOT NULL,
        message_text TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'logged',
        receipt_url VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 5. Tabla de Configuración Dinámica (Settings Editables desde Admin)
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Sembrar productos iniciales si la tabla está vacía
    $count = $pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
    if ($count == 0) {
        seedInitialProducts($pdo);
    }

    // Sembrar configuraciones iniciales si está vacía
    $countSettings = $pdo->query("SELECT COUNT(*) FROM settings")->fetchColumn();
    if ($countSettings == 0) {
        seedInitialSettings($pdo);
    }
}

function seedInitialSettings(PDO $pdo) {
    $defaults = [
        'announcement_badge' => 'PROMO ACTIVA',
        'announcement_text' => '15% OFF real pagando con Transferencia Bancaria o Efectivo en todo el catálogo.',
        'shipping_top_text' => 'Envíos en el día en CABA y GBA',
        'shipping_delivery_title' => 'Envíos Rápidos en el Día en CABA y GBA',
        'shipping_delivery_desc' => 'Entrega garantizada con franja horaria a elección durante el checkout.',
        'free_shipping_threshold' => '60000',
        'whatsapp_number' => '+54 9 11 4455-6677',
        'discount_transfer_enabled' => '1',
        'discount_transfer_percent' => '15',
        
        // Datos bancarios
        'bank_name' => 'Banco Galicia / Mercado Pago',
        'bank_holder' => 'PETSHOP PRO SRL',
        'bank_cuit' => '30-71648291-4',
        'bank_alias' => 'CONVIVIA.PETS',
        'bank_cbu' => '0070123130004018293812',

        // 4 Pilares de Confianza
        'pillar1_icon' => '🚚',
        'pillar1_title' => 'Despacho en 24 Horas',
        'pillar1_desc' => 'Envíos ágiles en CABA y GBA para que tu mascota nunca se quede sin comida.',

        'pillar2_icon' => '💸',
        'pillar2_title' => '15% OFF Transparente',
        'pillar2_desc' => 'Sin comisiones bancarias escondidas. Todo el ahorro directo para vos.',

        'pillar3_icon' => '🥣',
        'pillar3_title' => 'Smart Bowl Predictivo',
        'pillar3_desc' => 'Calcula la duración exacta de la bolsa y te avisa antes de que se acabe el plato.',

        'pillar4_icon' => '⚡',
        'pillar4_title' => 'Verificación Instantánea',
        'pillar4_desc' => 'Revisión rápida de transferencias y liberación de stock en tiempo real.',

        // Telegram Bot
        'telegram_token' => '',
        'telegram_chat_id' => '',
        'telegram_enabled' => '0'
    ];

    $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (:key, :val)");
    foreach ($defaults as $k => $v) {
        $stmt->execute(['key' => $k, 'val' => $v]);
    }
}

function seedInitialProducts(PDO $pdo) {
    // Los productos oficiales se importan directamente desde los scrapers oficiales de Baires S.A., Mon Ami y Nutricare.
    // No se insertan productos de muestra.
}
