<?php
// router.php - Enrutador para servidor de desarrollo PHP (php -S localhost:8000 router.php)

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Servir archivos estáticos directamente si existen
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    return false;
}

// Redirección amigable a panel de administración
if ($uri === '/admin' || $uri === '/admin/') {
    include __DIR__ . '/admin/index.html';
    exit;
}

// Redirección amigable a página de rastreo de pedidos
if ($uri === '/rastreo' || $uri === '/rastreo/') {
    include __DIR__ . '/rastreo.html';
    exit;
}

// Redirección amigable a página de producto
if ($uri === '/product' || $uri === '/producto' || $uri === '/product/' || $uri === '/producto/') {
    include __DIR__ . '/product.html';
    exit;
}

// Si la ruta inicia con /api/
if (strpos($uri, '/api/') === 0) {
    $script = __DIR__ . $uri;
    if (file_exists($script)) {
        include $script;
        exit;
    }
    if (file_exists($script . '.php')) {
        include $script . '.php';
        exit;
    }
    http_response_code(404);
    echo json_encode(['error' => 'API endpoint not found']);
    exit;
}

// Por defecto servir la tienda principal
include __DIR__ . '/index.html';
