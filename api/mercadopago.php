<?php
// api/mercadopago.php - Endpoints SDK v2 Checkout Pro, Wallet Brick, Verificación y Webhook IPN de Mercado Pago
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, x-signature, x-request-id');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/mercadopago.php';

$pdo = getDBConnection();

$rawInput = file_get_contents('php://input');
$jsonInput = !empty($rawInput) ? json_decode($rawInput, true) : null;
$input = is_array($jsonInput) ? $jsonInput : $_POST;

$action = $_GET['action'] ?? ($input['action'] ?? 'public_config');

// Overrides opcionales (exclusivo para pruebas desde Panel Admin antes de guardar)
$overrides = [];
if (!empty($input['mp_access_token'])) $overrides['access_token'] = $input['mp_access_token'];
if (!empty($input['mp_public_key'])) $overrides['public_key'] = $input['mp_public_key'];
if (!empty($input['mp_webhook_secret'])) $overrides['webhook_secret'] = $input['mp_webhook_secret'];

$mpConfig = MercadoPagoSDK::resolveConfig($pdo, $overrides);

function getSiteBaseUrl(): string {
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    return ($isHttps ? 'https://' : 'http://') . $host;
}

// -------------------------------------------------------------------------
// 1. ACTION: PUBLIC_CONFIG - Configuración no sensible para el Frontend SDK v2
// -------------------------------------------------------------------------
if ($action === 'public_config') {
    echo json_encode([
        'status' => 'success',
        'enabled' => $mpConfig['enabled'],
        'configured' => $mpConfig['configured'],
        'public_key' => $mpConfig['public_key'],
        'sandbox' => $mpConfig['sandbox'],
        'max_installments' => $mpConfig['max_installments']
    ]);
    exit;
}

// -------------------------------------------------------------------------
// 2. ACTION: STATUS / TEST - Validar Access Token y cuenta conectada en /users/me
// -------------------------------------------------------------------------
if ($action === 'status' || $action === 'test') {
    if (!$mpConfig['has_access_token']) {
        echo json_encode([
            'status' => 'unconfigured',
            'configured' => false,
            'enabled' => $mpConfig['enabled'],
            'has_public_key' => $mpConfig['has_public_key'],
            'sandbox' => $mpConfig['sandbox'],
            'source' => $mpConfig['source'],
            'message' => 'Mercado Pago no configurado aún. Ingresá tu Public Key y Access Token.'
        ]);
        exit;
    }

    $resp = MercadoPagoSDK::verifyToken($mpConfig['access_token']);
    if ($resp['ok'] && !empty($resp['data'])) {
        $u = $resp['data'];
        echo json_encode([
            'status' => 'success',
            'configured' => !empty($mpConfig['public_key']),
            'has_access_token' => true,
            'has_public_key' => $mpConfig['has_public_key'],
            'enabled' => $mpConfig['enabled'],
            'sandbox' => $mpConfig['sandbox'],
            'mode_label' => $mpConfig['sandbox'] ? 'Sandbox (Pruebas)' : 'Producción Real',
            'source' => $mpConfig['source'],
            'account' => [
                'id' => $u['id'] ?? null,
                'nickname' => $u['nickname'] ?? '',
                'email' => $u['email'] ?? '',
                'site_id' => $u['site_id'] ?? 'MLA',
                'first_name' => $u['first_name'] ?? '',
                'last_name' => $u['last_name'] ?? ''
            ],
            'message' => "Conectado a cuenta @{$u['nickname']} ({$u['site_id']})"
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'configured' => false,
            'enabled' => $mpConfig['enabled'],
            'http_code' => $resp['http_code'],
            'message' => 'Error validando Access Token en Mercado Pago: ' . ($resp['message'] ?? 'Token inválido')
        ]);
    }
    exit;
}

// -------------------------------------------------------------------------
// 3. ACTION: TEST_PREFERENCE - Prueba real creando una preferencia de $100 ARS
// -------------------------------------------------------------------------
if ($action === 'test_preference') {
    if (!$mpConfig['has_access_token']) {
        echo json_encode(['status' => 'error', 'message' => 'Ingresá el Access Token para probar el Checkout Pro.']);
        exit;
    }
    $siteBase = getSiteBaseUrl();
    $payload = [
        'items' => [[
            'id' => 'CONVIVIA-TEST',
            'title' => 'Prueba de Integración CONVIVIA SDK v2',
            'quantity' => 1,
            'unit_price' => 100.00,
            'currency_id' => 'ARS'
        ]],
        'external_reference' => 'TEST-' . time(),
        'statement_descriptor' => 'CONVIVIA PETSHOP',
        'back_urls' => [
            'success' => $siteBase . '/rastreo.html',
            'pending' => $siteBase . '/rastreo.html',
            'failure' => $siteBase . '/rastreo.html'
        ]
    ];
    if (strpos($siteBase, 'https://') === 0 && stripos($siteBase, 'localhost') === false) {
        $payload['auto_return'] = 'approved';
    }

    $resp = MercadoPagoSDK::createPreference($mpConfig['access_token'], $payload);
    if ($resp['ok'] && !empty($resp['data']['id'])) {
        echo json_encode([
            'status' => 'success',
            'preference_id' => $resp['data']['id'],
            'init_point' => $resp['data']['init_point'] ?? '',
            'sandbox_init_point' => $resp['data']['sandbox_init_point'] ?? '',
            'checkout_url' => ($mpConfig['sandbox'] && !empty($resp['data']['sandbox_init_point']))
                ? $resp['data']['sandbox_init_point']
                : ($resp['data']['init_point'] ?? ''),
            'message' => '¡Preferencia Checkout Pro generada con éxito! El SDK está operativo.'
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'No se pudo generar preferencia en Mercado Pago: ' . ($resp['message'] ?? 'Error desconocido'),
            'details' => $resp['data'] ?? null
        ]);
    }
    exit;
}

// -------------------------------------------------------------------------
// 4. ACTION: CREATE_PREFERENCE - Generar Preferencia Checkout Pro para un Pedido
// -------------------------------------------------------------------------
if ($action === 'create_preference') {
    if (!$mpConfig['has_access_token']) {
        echo json_encode([
            'status' => 'error',
            'code' => 'MP_NOT_CONFIGURED',
            'message' => 'Mercado Pago no está configurado con un Access Token válido en el Panel Admin.'
        ]);
        exit;
    }

    $orderId = intval($input['order_id'] ?? 0);
    $orderNumber = trim($input['order_number'] ?? '');

    $order = null;
    $orderItems = [];

    if ($orderId > 0 || !empty($orderNumber)) {
        if ($orderId > 0) {
            $stmtO = $pdo->prepare("SELECT * FROM orders WHERE id = :id LIMIT 1");
            $stmtO->execute(['id' => $orderId]);
        } else {
            $stmtO = $pdo->prepare("SELECT * FROM orders WHERE order_number = :num LIMIT 1");
            $stmtO->execute(['num' => $orderNumber]);
        }
        $order = $stmtO->fetch();
        if ($order) {
            $orderId = intval($order['id']);
            $orderNumber = $order['order_number'];
            $stmtIt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = :oid");
            $stmtIt->execute(['oid' => $orderId]);
            $orderItems = $stmtIt->fetchAll();
        }
    }

    // Fallback si la orden viene en payload directo (ej. entorno sin DB persistente)
    $fallbackOrder = is_array($input['order'] ?? null) ? $input['order'] : null;
    if (!$order && $fallbackOrder) {
        $order = $fallbackOrder;
        $orderNumber = $order['order_number'] ?? ('PW-' . strtoupper(bin2hex(random_bytes(3))));
        $orderItems = $order['items'] ?? [];
    }

    if (!$order || empty($orderNumber)) {
        echo json_encode(['status' => 'error', 'message' => 'No se encontraron datos de la orden para generar el pago.']);
        exit;
    }

    $mpItems = [];
    $itemsSum = 0.0;
    foreach ($orderItems as $it) {
        $qty = max(1, intval($it['quantity'] ?? 1));
        $unitPrice = round(floatval($it['unit_price'] ?? 0), 2);
        if ($unitPrice <= 0 && !empty($it['subtotal'])) {
            $unitPrice = round(floatval($it['subtotal']) / $qty, 2);
        }
        if ($unitPrice > 0) {
            $weightTxt = !empty($it['weight_kg']) ? " ({$it['weight_kg']}kg)" : '';
            $title = trim(($it['product_name'] ?? ($it['name'] ?? 'Alimento Mascota')) . $weightTxt);
            $mpItems[] = [
                'id' => (string)($it['product_id'] ?? ($it['id'] ?? 'ITEM')),
                'title' => mb_substr($title, 0, 250),
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'currency_id' => 'ARS'
            ];
            $itemsSum += ($unitPrice * $qty);
        }
    }

    $shippingCost = round(floatval($order['shipping_cost'] ?? 0), 2);
    if ($shippingCost > 0) {
        $zoneName = trim($order['shipping_zone'] ?? 'Bahía Blanca');
        $mpItems[] = [
            'id' => 'ENVIO',
            'title' => mb_substr("Envío Domicilio ({$zoneName})", 0, 250),
            'quantity' => 1,
            'unit_price' => $shippingCost,
            'currency_id' => 'ARS'
        ];
        $itemsSum += $shippingCost;
    }

    $orderTotal = round(floatval($order['total'] ?? $itemsSum), 2);
    // Verificar consistencia exacta entre total de la orden y suma de ítems MP
    if (empty($mpItems) || ($orderTotal > 0 && abs($itemsSum - $orderTotal) > 1.0)) {
        $mpItems = [[
            'id' => $orderNumber,
            'title' => "Pedido CONVIVIA #{$orderNumber}",
            'quantity' => 1,
            'unit_price' => $orderTotal > 0 ? $orderTotal : round($itemsSum, 2),
            'currency_id' => 'ARS'
        ]];
    }

    $siteBase = getSiteBaseUrl();
    $isPublicHttps = (strpos($siteBase, 'https://') === 0 && stripos($siteBase, 'localhost') === false && stripos($siteBase, '127.0.0.1') === false);

    $encodedOrderNum = urlencode($orderNumber);
    $preferencePayload = [
        'items' => $mpItems,
        'payer' => [
            'name' => trim($order['customer_name'] ?? 'Cliente CONVIVIA'),
            'email' => !empty($order['customer_email']) ? trim($order['customer_email']) : 'compras@convivia.com.ar',
            'phone' => [
                'number' => preg_replace('/[^0-9]/', '', $order['customer_whatsapp'] ?? '')
            ],
            'address' => [
                'street_name' => trim($order['customer_address'] ?? 'Bahía Blanca')
            ]
        ],
        'external_reference' => $orderNumber,
        'statement_descriptor' => 'CONVIVIA PETSHOP',
        'payment_methods' => [
            'installments' => $mpConfig['max_installments']
        ],
        'back_urls' => [
            'success' => "{$siteBase}/rastreo.html?order={$encodedOrderNum}&mp_status=approved",
            'pending' => "{$siteBase}/rastreo.html?order={$encodedOrderNum}&mp_status=pending",
            'failure' => "{$siteBase}/rastreo.html?order={$encodedOrderNum}&mp_status=failure"
        ],
        'metadata' => [
            'order_id' => $orderId,
            'order_number' => $orderNumber
        ]
    ];

    if ($isPublicHttps) {
        $preferencePayload['auto_return'] = 'approved';
        $preferencePayload['notification_url'] = "{$siteBase}/api/mercadopago.php?action=webhook";
    }

    $resp = MercadoPagoSDK::createPreference($mpConfig['access_token'], $preferencePayload);
    if (!$resp['ok'] || empty($resp['data']['id'])) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Error generando link de pago en Mercado Pago: ' . ($resp['message'] ?? 'Error API'),
            'details' => $resp['data'] ?? null
        ]);
        exit;
    }

    $pref = $resp['data'];
    $prefId = $pref['id'];
    $checkoutUrl = ($mpConfig['sandbox'] && !empty($pref['sandbox_init_point']))
        ? $pref['sandbox_init_point']
        : ($pref['init_point'] ?? '');

    if ($orderId > 0) {
        try {
            $stmtSave = $pdo->prepare("UPDATE orders SET mp_preference_id = :pref, mp_payment_status = 'preference_created' WHERE id = :id");
            $stmtSave->execute(['pref' => $prefId, 'id' => $orderId]);
            syncAllDataMirrors($pdo);
        } catch (Exception $eSave) {}
    }

    echo json_encode([
        'status' => 'success',
        'preference_id' => $prefId,
        'init_point' => $pref['init_point'] ?? '',
        'sandbox_init_point' => $pref['sandbox_init_point'] ?? '',
        'checkout_url' => $checkoutUrl,
        'public_key' => $mpConfig['public_key'],
        'sandbox' => $mpConfig['sandbox'],
        'order_number' => $orderNumber
    ]);
    exit;
}

// -------------------------------------------------------------------------
// 5. ACTION: CHECK_PAYMENT - Verificación activa tras retorno de Checkout Pro / Admin
// -------------------------------------------------------------------------
if ($action === 'check_payment') {
    if (!$mpConfig['has_access_token']) {
        echo json_encode(['status' => 'error', 'message' => 'Access Token de Mercado Pago no configurado']);
        exit;
    }

    $paymentId = trim($_GET['payment_id'] ?? ($_GET['collection_id'] ?? ($input['payment_id'] ?? '')));
    $orderNumber = trim($_GET['order'] ?? ($_GET['external_reference'] ?? ($input['order_number'] ?? '')));

    if (empty($paymentId) && !empty($orderNumber)) {
        // Buscar si ya tiene mp_payment_id o buscar por external_reference en API MP
        $stmtOrd = $pdo->prepare("SELECT mp_payment_id FROM orders WHERE order_number = :num LIMIT 1");
        $stmtOrd->execute(['num' => $orderNumber]);
        $existingPid = $stmtOrd->fetchColumn();
        if (!empty($existingPid)) {
            $paymentId = $existingPid;
        } else {
            // Consultar API de búsqueda de pagos de Mercado Pago por external_reference
            $searchResp = MercadoPagoSDK::request('GET', '/v1/payments/search?sort=date_created&criteria=desc&external_reference=' . urlencode($orderNumber), $mpConfig['access_token']);
            if ($searchResp['ok'] && !empty($searchResp['data']['results'][0]['id'])) {
                $paymentId = (string)$searchResp['data']['results'][0]['id'];
            }
        }
    }

    if (empty($paymentId)) {
        echo json_encode(['status' => 'pending', 'message' => 'Aún no se registró un ID de pago en Mercado Pago para esta orden.']);
        exit;
    }

    $payResp = MercadoPagoSDK::getPayment($mpConfig['access_token'], $paymentId);
    if (!$payResp['ok'] || empty($payResp['data'])) {
        echo json_encode([
            'status' => 'error',
            'message' => 'No se pudo consultar el pago en Mercado Pago: ' . ($payResp['message'] ?? 'No encontrado')
        ]);
        exit;
    }

    $payment = $payResp['data'];
    $applied = MercadoPagoSDK::applyPaymentToOrder($pdo, $payment, $mpConfig);

    echo json_encode([
        'status' => 'success',
        'payment' => [
            'id' => $payment['id'] ?? $paymentId,
            'status' => $payment['status'] ?? 'unknown',
            'status_detail' => $payment['status_detail'] ?? '',
            'external_reference' => $payment['external_reference'] ?? '',
            'transaction_amount' => floatval($payment['transaction_amount'] ?? 0),
            'payment_method_id' => $payment['payment_method_id'] ?? '',
            'installments' => intval($payment['installments'] ?? 1)
        ],
        'order_update' => $applied
    ]);
    exit;
}

// -------------------------------------------------------------------------
// 6. ACTION: WEBHOOK - Receptor oficial IPN / Webhooks v1 & v2 de Mercado Pago
// -------------------------------------------------------------------------
if ($action === 'webhook') {
    // Extraer topic/type e ID tanto de Webhooks JSON v2 como IPN Query Params v1
    $type = $_GET['type'] ?? ($_GET['topic'] ?? ($input['type'] ?? ($input['topic'] ?? '')));
    $dataId = $_GET['data_id'] ?? ($_GET['id'] ?? ($input['data']['id'] ?? ($input['resource'] ?? '')));
    // En Apache/Nginx a veces ?data.id=123 llega como data_id en $_GET
    if (empty($dataId) && isset($_GET['data.id'])) {
        $dataId = $_GET['data.id'];
    }

    // Validación de firma HMAC si hay webhook_secret configurado
    $xSignature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
    $xRequestId = $_SERVER['HTTP_X_REQUEST_ID'] ?? '';
    if (!empty($mpConfig['webhook_secret']) && !empty($xSignature) && !empty($dataId)) {
        if (!MercadoPagoSDK::validateWebhookSignature($xSignature, $xRequestId, (string)$dataId, $mpConfig['webhook_secret'])) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Invalid webhook signature']);
            exit;
        }
    }

    if (!$mpConfig['has_access_token']) {
        http_response_code(200);
        echo json_encode(['status' => 'ignored', 'reason' => 'No access token configured']);
        exit;
    }

    $handled = null;
    if (($type === 'payment' || strpos((string)$type, 'payment') !== false) && !empty($dataId)) {
        $payResp = MercadoPagoSDK::getPayment($mpConfig['access_token'], (string)$dataId);
        if ($payResp['ok'] && !empty($payResp['data'])) {
            $handled = MercadoPagoSDK::applyPaymentToOrder($pdo, $payResp['data'], $mpConfig);
        }
    } elseif ($type === 'merchant_order' && !empty($dataId)) {
        $cleanOrderId = basename(parse_url((string)$dataId, PHP_URL_PATH));
        $moResp = MercadoPagoSDK::getMerchantOrder($mpConfig['access_token'], $cleanOrderId);
        if ($moResp['ok'] && !empty($moResp['data']['payments'])) {
            foreach ($moResp['data']['payments'] as $moPay) {
                if (!empty($moPay['id'])) {
                    $pResp = MercadoPagoSDK::getPayment($mpConfig['access_token'], (string)$moPay['id']);
                    if ($pResp['ok'] && !empty($pResp['data'])) {
                        $handled = MercadoPagoSDK::applyPaymentToOrder($pdo, $pResp['data'], $mpConfig);
                    }
                }
            }
        }
    }

    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'type' => $type,
        'data_id' => $dataId,
        'handled' => $handled
    ]);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Acción de Mercado Pago no reconocida']);
