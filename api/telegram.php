<?php
// api/telegram.php - Módulo Centralizado de Bot de Telegram, Pruebas y Webhook Interactivo
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/sync.php';

$pdo = getDBConnection();

// Cargar settings de la DB o archivo JSON de respaldo
$settings = [];
try {
    $rows = $pdo->query("SELECT setting_key, setting_value FROM settings")->fetchAll(PDO::FETCH_KEY_PAIR);
    if ($rows) {
        $settings = $rows;
    }
} catch (Exception $e) {}

if (empty($settings)) {
    $settingsJson = __DIR__ . '/../assets/data/settings.json';
    if (file_exists($settingsJson)) {
        $data = json_decode(file_get_contents($settingsJson), true);
        if ($data && !empty($data['settings'])) {
            $settings = $data['settings'];
        }
    }
}

// Obtener payload
$rawInput = file_get_contents('php://input');
$jsonInput = !empty($rawInput) ? json_decode($rawInput, true) : null;
$input = is_array($jsonInput) ? $jsonInput : $_POST;

$action = $_GET['action'] ?? ($input['action'] ?? 'status');

// Resolver credenciales: prioritariamente desde input (para pruebas en vivo sin guardar), luego settings, luego variables de entorno
$token = trim($input['token'] ?? ($input['telegram_token'] ?? ($settings['telegram_token'] ?? (getenv('TELEGRAM_BOT_TOKEN') ?: ''))));
$chatId = trim($input['chat_id'] ?? ($input['telegram_chat_id'] ?? ($settings['telegram_chat_id'] ?? (getenv('TELEGRAM_CHAT_ID') ?: ''))));
$enabled = ($settings['telegram_enabled'] ?? '0') === '1' || (bool)getenv('TELEGRAM_BOT_TOKEN');

// Helper para llamadas a Telegram API con timeout seguro
function callTelegramApi(string $token, string $method, array $params = []): array {
    if (empty($token)) {
        return ['ok' => false, 'description' => 'Token de bot no provisto'];
    }
    $url = "https://api.telegram.org/bot" . $token . "/" . $method;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return ['ok' => false, 'description' => "Error de conexión cURL: " . $curlErr];
    }
    $decoded = json_decode($response, true);
    return is_array($decoded) ? $decoded : ['ok' => false, 'description' => "Respuesta no JSON: " . substr($response, 0, 150)];
}

// -------------------------------------------------------------------------
// 1. ACTION: STATUS - Consultar estado del Bot en Telegram (getMe)
// -------------------------------------------------------------------------
if ($action === 'status') {
    if (empty($token)) {
        echo json_encode([
            'status' => 'unconfigured',
            'configured' => false,
            'enabled' => $enabled,
            'message' => 'Bot de Telegram no configurado. Ingresá el token obtenido de @BotFather.'
        ]);
        exit;
    }

    $resp = callTelegramApi($token, 'getMe');
    if (!empty($resp['ok'])) {
        echo json_encode([
            'status' => 'success',
            'configured' => true,
            'enabled' => $enabled,
            'bot' => [
                'id' => $resp['result']['id'] ?? null,
                'first_name' => $resp['result']['first_name'] ?? '',
                'username' => $resp['result']['username'] ?? '',
                'can_join_groups' => $resp['result']['can_join_groups'] ?? false,
                'can_read_all_group_messages' => $resp['result']['can_read_all_group_messages'] ?? false
            ],
            'chat_id' => $chatId,
            'has_chat_id' => !empty($chatId),
            'message' => "Bot conectado correctamente como @{$resp['result']['username']}"
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'configured' => false,
            'enabled' => $enabled,
            'error_description' => $resp['description'] ?? 'Token inválido o bot no encontrado',
            'message' => 'No se pudo conectar con Telegram: ' . ($resp['description'] ?? 'Token inválido')
        ]);
    }
    exit;
}

// -------------------------------------------------------------------------
// 2. ACTION: TEST - Envío de mensaje de prueba en vivo
// -------------------------------------------------------------------------
if ($action === 'test') {
    if (empty($token) || empty($chatId)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Debes ingresar el Token del Bot y el ID de Chat antes de enviar la prueba.'
        ]);
        exit;
    }

    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
    $siteUrl = $protocol . $host;
    $adminUrl = $siteUrl . '/admin/#telegram';
    $currentDateTime = date('d/m/Y H:i:s');

    $htmlMsg = "🔔 <b>¡CONEXIÓN EXITOSA CON CONVIVIA!</b> 🐾\n";
    $htmlMsg .= "━━━━━━━━━━━━━━━━━━━━━━\n";
    $htmlMsg .= "Tu bot de Telegram está <b>correctamente vinculado</b>.\n";
    $htmlMsg .= "A partir de ahora, cada compra realizada en la tienda despachará una alerta inmediata a este chat con:\n\n";
    $htmlMsg .= "• Datos del cliente y enlace directo a su WhatsApp\n";
    $htmlMsg .= "• Dirección y zona de entrega acordada\n";
    $htmlMsg .= "• Ítems, pesos y combos adquiridos\n";
    $htmlMsg .= "• Comprobante de transferencia adjunto\n\n";
    $htmlMsg .= "⏱️ <i>Prueba realizada el: {$currentDateTime}</i>\n";
    $htmlMsg .= "━━━━━━━━━━━━━━━━━━━━━━";

    $keyboard = [
        'inline_keyboard' => [
            [
                ['text' => '🌐 Ver Tienda en Vivo', 'url' => $siteUrl],
                ['text' => '⚙️ Panel Admin', 'url' => $adminUrl]
            ]
        ]
    ];

    $params = [
        'chat_id' => $chatId,
        'text' => $htmlMsg,
        'parse_mode' => 'HTML',
        'reply_markup' => json_encode($keyboard)
    ];

    $resp = callTelegramApi($token, 'sendMessage', $params);

    if (empty($resp['ok'])) {
        // Reintento en texto plano si Telegram rechaza el formato HTML
        $plainMsg = "🔔 ¡CONEXIÓN EXITOSA CON CONVIVIA! 🐾\n\nTu bot de Telegram está vinculado y listo para despachar pedidos en tiempo real.\nFecha: {$currentDateTime}";
        $params['text'] = $plainMsg;
        unset($params['parse_mode']);
        $resp = callTelegramApi($token, 'sendMessage', $params);
    }

    if (!empty($resp['ok'])) {
        echo json_encode([
            'status' => 'success',
            'message' => '¡Mensaje de prueba enviado con éxito! Revisá tu conversación con el bot en Telegram.',
            'message_id' => $resp['result']['message_id'] ?? null
        ]);
    } else {
        $desc = $resp['description'] ?? 'Error desconocido';
        $tip = "";
        if (stripos($desc, 'chat not found') !== false || stripos($desc, 'bot was blocked') !== false) {
            $tip = " Asegurate de haber abierto el bot en Telegram y presionado el botón 'INICIAR' (/start).";
        } elseif (stripos($desc, 'unauthorized') !== false) {
            $tip = " Verificá que el Token de @BotFather no tenga espacios ni caracteres faltantes.";
        }
        echo json_encode([
            'status' => 'error',
            'message' => 'Telegram respondió con error: ' . $desc . $tip,
            'details' => $resp
        ]);
    }
    exit;
}

// -------------------------------------------------------------------------
// 3. ACTION: SET_WEBHOOK - Configurar Webhook en Telegram
// -------------------------------------------------------------------------
if ($action === 'set_webhook') {
    if (empty($token)) {
        echo json_encode(['status' => 'error', 'message' => 'Token no provisto']);
        exit;
    }

    $customUrl = trim($input['webhook_url'] ?? '');
    if (empty($customUrl)) {
        $host = $_SERVER['HTTP_HOST'] ?? 'convivia.com.ar';
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
        $protocol = $isHttps ? 'https://' : 'https://'; // Telegram exige HTTPS para webhooks
        $customUrl = $protocol . $host . '/api/telegram.php?action=webhook';
    }

    $resp = callTelegramApi($token, 'setWebhook', [
        'url' => $customUrl,
        'allowed_updates' => json_encode(['message', 'callback_query'])
    ]);

    if (!empty($resp['ok'])) {
        echo json_encode([
            'status' => 'success',
            'message' => "Webhook configurado exitosamente hacia: {$customUrl}",
            'webhook_url' => $customUrl,
            'details' => $resp
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'Error al configurar webhook: ' . ($resp['description'] ?? 'Error desconocido'),
            'details' => $resp
        ]);
    }
    exit;
}

// -------------------------------------------------------------------------
// 4. ACTION: WEBHOOK_INFO - Consultar estado del webhook
// -------------------------------------------------------------------------
if ($action === 'webhook_info') {
    if (empty($token)) {
        echo json_encode(['status' => 'error', 'message' => 'Token no provisto']);
        exit;
    }
    $resp = callTelegramApi($token, 'getWebhookInfo');
    echo json_encode([
        'status' => !empty($resp['ok']) ? 'success' : 'error',
        'info' => $resp['result'] ?? null,
        'raw' => $resp
    ]);
    exit;
}

// -------------------------------------------------------------------------
// 5. ACTION: WEBHOOK - Receptor interactivo de mensajes y botones de Telegram
// -------------------------------------------------------------------------
if ($action === 'webhook') {
    // Si no es un POST de Telegram, devolver OK para verificación de enlace
    if (empty($rawInput)) {
        echo json_encode(['status' => 'ok', 'message' => 'Webhook endpoint ready']);
        exit;
    }

    $update = json_decode($rawInput, true);
    if (!is_array($update)) {
        echo json_encode(['status' => 'ignored']);
        exit;
    }

    // A. Manejo de Botones Interactivos (Callback Queries, ej: Aprobar Pago)
    if (isset($update['callback_query'])) {
        $cb = $update['callback_query'];
        $cbId = $cb['id'] ?? '';
        $data = $cb['data'] ?? '';
        $fromId = $cb['from']['id'] ?? '';
        $fromUser = $cb['from']['username'] ?? ($cb['from']['first_name'] ?? 'Admin');
        $msgId = $cb['message']['message_id'] ?? null;
        $chatTarget = $cb['message']['chat']['id'] ?? $fromId;

        if (strpos($data, 'approve_') === 0) {
            $orderId = intval(substr($data, 8));
            if ($orderId > 0) {
                // Verificar orden en DB
                $stmtOrd = $pdo->prepare("SELECT * FROM orders WHERE id = :id");
                $stmtOrd->execute(['id' => $orderId]);
                $order = $stmtOrd->fetch();

                if ($order) {
                    $orderNum = $order['order_number'];
                    $prevStatus = $order['status'];

                    // Actualizar a aprobado si no lo estaba
                    if ($prevStatus !== 'aprobado' && $prevStatus !== 'confirmado' && $prevStatus !== 'despachado') {
                        // Descontar stock
                        $stmtItems = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = :oid");
                        $stmtItems->execute(['oid' => $orderId]);
                        $items = $stmtItems->fetchAll();
                        foreach ($items as $it) {
                            $stmtStock = $pdo->prepare("UPDATE products SET stock = CASE WHEN stock > :qty THEN stock - :qty ELSE 0 END WHERE id = :pid");
                            $stmtStock->execute(['qty' => $it['quantity'], 'pid' => $it['product_id']]);
                        }

                        $logNote = "[" . date('d/m/Y H:i:s') . "] ✓ Pago aprobado desde Telegram Bot por @" . $fromUser;
                        $existingNotes = trim($order['notes'] ?? '');
                        $newNotes = $existingNotes ? ($existingNotes . "\n" . $logNote) : $logNote;

                        $stmtUpd = $pdo->prepare("UPDATE orders SET status = 'aprobado', notes = :notes WHERE id = :id");
                        $stmtUpd->execute(['notes' => $newNotes, 'id' => $orderId]);
                        syncAllDataMirrors($pdo);

                        // Responder a la interacción del botón con un Toast emergente
                        callTelegramApi($token, 'answerCallbackQuery', [
                            'callback_query_id' => $cbId,
                            'text' => "✓ ¡Orden {$orderNum} aprobada con éxito y stock reservado!",
                            'show_alert' => true
                        ]);

                        // Enviar confirmación al chat
                        callTelegramApi($token, 'sendMessage', [
                            'chat_id' => $chatTarget,
                            'text' => "✅ <b>PAGO APROBADO:</b> La orden <code>{$orderNum}</code> fue aprobada por @{$fromUser}.\nEl stock ha sido reservado correctamente.",
                            'parse_mode' => 'HTML'
                        ]);
                    } else {
                        callTelegramApi($token, 'answerCallbackQuery', [
                            'callback_query_id' => $cbId,
                            'text' => "ℹ️ La orden {$orderNum} ya se encuentra en estado '{$prevStatus}'.",
                            'show_alert' => false
                        ]);
                    }
                } else {
                    callTelegramApi($token, 'answerCallbackQuery', [
                        'callback_query_id' => $cbId,
                        'text' => "⚠️ Orden #{$orderId} no encontrada.",
                        'show_alert' => true
                    ]);
                }
            }
        }
        echo json_encode(['status' => 'callback_handled']);
        exit;
    }

    // B. Manejo de Mensajes de Texto de Usuarios / Administradores
    if (isset($update['message'])) {
        $msg = $update['message'];
        $senderChatId = $msg['chat']['id'] ?? '';
        $text = trim($msg['text'] ?? '');
        $senderName = $msg['from']['first_name'] ?? 'Administrador';

        $host = $_SERVER['HTTP_HOST'] ?? 'convivia.com.ar';
        $siteUrl = 'https://' . $host;

        if ($text === '/start') {
            $reply = "🐾 <b>¡Hola, {$senderName}!</b>\n";
            $reply .= "Soy el <b>Bot Operativo de CONVIVIA Pet Shop</b>.\n\n";
            $reply .= "Te avisaré al instante cuando ingrese un nuevo pedido desde la web.\n\n";
            $reply .= "📌 <b>Comandos disponibles:</b>\n";
            $reply .= "• <code>/pedidos</code> - Ver últimos 5 pedidos recibidos\n";
            $reply .= "• <code>/estado</code> - Resumen del sistema y base de datos\n";
            $reply .= "• <code>/ayuda</code> - Guía y preguntas frecuentes\n\n";
            $reply .= "<i>Tu Chat ID es:</i> <code>{$senderChatId}</code>";

            callTelegramApi($token, 'sendMessage', [
                'chat_id' => $senderChatId,
                'text' => $reply,
                'parse_mode' => 'HTML',
                'reply_markup' => json_encode([
                    'inline_keyboard' => [
                        [['text' => '🌐 Ir a la Tienda', 'url' => $siteUrl], ['text' => '📦 Panel Admin', 'url' => "{$siteUrl}/admin/#orders"]]
                    ]
                ])
            ]);
        } elseif ($text === '/pedidos') {
            $orders = [];
            try {
                $stmt = $pdo->query("SELECT * FROM orders ORDER BY id DESC LIMIT 5");
                $orders = $stmt ? $stmt->fetchAll() : [];
            } catch (Exception $e) {}

            if (empty($orders)) {
                $ordersJson = __DIR__ . '/../assets/data/orders.json';
                if (file_exists($ordersJson)) {
                    $d = json_decode(file_get_contents($ordersJson), true);
                    $orders = array_slice($d['orders'] ?? [], 0, 5);
                }
            }

            if (empty($orders)) {
                $reply = "📦 <b>ÚLTIMOS PEDIDOS CONVIVIA:</b>\n\nNo hay pedidos registrados en este momento. ¡La tienda está lista para recibir ventas!";
            } else {
                $reply = "📦 <b>ÚLTIMOS " . count($orders) . " PEDIDOS CONVIVIA:</b>\n";
                $reply .= "━━━━━━━━━━━━━━━━━━━━━━\n";
                foreach ($orders as $ord) {
                    $cleanTel = preg_replace('/[^0-9]/', '', $ord['customer_whatsapp'] ?? '');
                    $statusLabel = [
                        'pendiente_validacion' => '⏳ Pend. Validación',
                        'pendiente_comprobante' => '⚠️ Pend. Comprobante',
                        'aprobado' => '✓ Aprobado',
                        'confirmado' => '✓ Confirmado',
                        'despachado' => '🚚 Despachado',
                        'completado' => '🎉 Completado',
                        'cancelado' => '✕ Cancelado'
                    ][$ord['status']] ?? $ord['status'];

                    $reply .= "• <b>{$ord['order_number']}</b> | \$" . number_format($ord['total'], 0, ',', '.') . "\n";
                    $reply .= "  👤 {$ord['customer_name']}\n";
                    $reply .= "  📱 <a href=\"https://wa.me/{$cleanTel}\">WhatsApp</a> | Estado: <b>{$statusLabel}</b>\n\n";
                }
                $reply .= "━━━━━━━━━━━━━━━━━━━━━━";
            }

            callTelegramApi($token, 'sendMessage', [
                'chat_id' => $senderChatId,
                'text' => $reply,
                'parse_mode' => 'HTML',
                'reply_markup' => json_encode([
                    'inline_keyboard' => [
                        [['text' => '📦 Ver todos en Panel', 'url' => "{$siteUrl}/admin/#orders"]]
                    ]
                ])
            ]);
        } elseif ($text === '/estado') {
            $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            $totalOrders = 0;
            $pendingOrders = 0;
            $totalSales = 0;

            try {
                $totalOrders = intval($pdo->query("SELECT COUNT(*) FROM orders")->fetchColumn() ?: 0);
                $pendingOrders = intval($pdo->query("SELECT COUNT(*) FROM orders WHERE status IN ('pendiente_validacion', 'pendiente_comprobante')")->fetchColumn() ?: 0);
                $totalSales = floatval($pdo->query("SELECT SUM(total) FROM orders WHERE status NOT IN ('cancelado', 'rechazado')")->fetchColumn() ?: 0);
            } catch (Exception $e) {}

            $reply = "📊 <b>ESTADO OPERATIVO CONVIVIA:</b>\n";
            $reply .= "━━━━━━━━━━━━━━━━━━━━━━\n";
            $reply .= "• <b>Motor DB:</b> " . strtoupper($driver) . "\n";
            $reply .= "• <b>Pedidos Totales:</b> {$totalOrders}\n";
            $reply .= "• <b>Pendientes de Atención:</b> {$pendingOrders}\n";
            $reply .= "• <b>Ventas Acumuladas:</b> \$" . number_format($totalSales, 0, ',', '.') . "\n";
            $reply .= "• <b>Envíos Rápidos:</b> Bahía Blanca\n";
            $reply .= "━━━━━━━━━━━━━━━━━━━━━━\n";
            $reply .= "🟢 Servidor en línea y listo para despachos.";

            callTelegramApi($token, 'sendMessage', [
                'chat_id' => $senderChatId,
                'text' => $reply,
                'parse_mode' => 'HTML'
            ]);
        } elseif ($text === '/ayuda') {
            $reply = "❓ <b>CENTRO DE AYUDA RÁPIDA:</b>\n\n";
            $reply .= "1. <b>¿Cómo aprobar un pago?</b> Hacé clic en el botón [✅ Aprobar Pago] debajo del pedido recibido.\n\n";
            $reply .= "2. <b>¿Cómo contactar al comprador?</b> Hacé clic en [💬 Contactar Cliente] para abrir WhatsApp con un solo toque.\n\n";
            $reply .= "3. <b>Comandos:</b>\n";
            $reply .= "/pedidos - Ver lista reciente\n";
            $reply .= "/estado - Métricas y conexión\n";
            $reply .= "/start - Reiniciar bot";

            callTelegramApi($token, 'sendMessage', [
                'chat_id' => $senderChatId,
                'text' => $reply,
                'parse_mode' => 'HTML'
            ]);
        }
    }

    echo json_encode(['status' => 'ok']);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Acción no reconocida']);
