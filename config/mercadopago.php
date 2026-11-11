<?php
// config/mercadopago.php - Cliente SDK Oficial REST & Checkout Pro para Mercado Pago (Zero-Dependency, Vercel & PHP 8 Compatible)
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/sync.php';

class MercadoPagoSDK {
    const API_BASE = 'https://api.mercadopago.com';

    /**
     * Resuelve credenciales y configuración combinando variables de entorno, base de datos y overrides opcionales.
     */
    public static function resolveConfig(?PDO $pdo = null, array $overrides = []): array {
        $dbSettings = [];
        if ($pdo) {
            try {
                $rows = $pdo->query("SELECT setting_key, setting_value FROM settings")->fetchAll(PDO::FETCH_KEY_PAIR);
                if (is_array($rows)) {
                    $dbSettings = $rows;
                }
            } catch (Exception $e) {}
        }

        $envAccess = getenv('MP_ACCESS_TOKEN') ?: (getenv('MERCADOPAGO_ACCESS_TOKEN') ?: (defined('MP_ACCESS_TOKEN') ? MP_ACCESS_TOKEN : ''));
        $envPublic = getenv('MP_PUBLIC_KEY') ?: (getenv('MERCADOPAGO_PUBLIC_KEY') ?: (defined('MP_PUBLIC_KEY') ? MP_PUBLIC_KEY : ''));
        $envSecret = getenv('MP_WEBHOOK_SECRET') ?: (getenv('MERCADOPAGO_WEBHOOK_SECRET') ?: (defined('MP_WEBHOOK_SECRET') ? MP_WEBHOOK_SECRET : ''));

        $accessToken = trim($overrides['access_token'] ?? (!empty($dbSettings['mp_access_token']) ? $dbSettings['mp_access_token'] : $envAccess));
        $publicKey   = trim($overrides['public_key'] ?? (!empty($dbSettings['mp_public_key']) ? $dbSettings['mp_public_key'] : $envPublic));
        $webhookSec  = trim($overrides['webhook_secret'] ?? (!empty($dbSettings['mp_webhook_secret']) ? $dbSettings['mp_webhook_secret'] : $envSecret));

        $source = !empty($overrides['access_token']) ? 'request' : (!empty($dbSettings['mp_access_token']) ? 'database' : (!empty($envAccess) ? 'environment' : 'none'));

        $hasExplicitEnabled = isset($dbSettings['mp_enabled']) && $dbSettings['mp_enabled'] !== '';
        $enabled = $hasExplicitEnabled
            ? ($dbSettings['mp_enabled'] === '1')
            : (!empty($accessToken) && !empty($publicKey));

        // Si las credenciales empiezan con TEST-, forzamos detección Sandbox salvo que se trate de APP_USR-
        $isSandboxCred = (strpos($accessToken, 'TEST-') === 0) || (strpos($publicKey, 'TEST-') === 0);
        $sandboxFlag = isset($dbSettings['mp_sandbox']) ? ($dbSettings['mp_sandbox'] === '1') : $isSandboxCred;
        if (strpos($accessToken, 'TEST-') === 0) {
            $sandboxFlag = true;
        } elseif (strpos($accessToken, 'APP_USR-') === 0 && isset($dbSettings['mp_sandbox']) && $dbSettings['mp_sandbox'] === '0') {
            $sandboxFlag = false;
        }

        $maxInstallments = max(1, min(24, intval($dbSettings['mp_max_installments'] ?? 6)));

        $isServerlessEphemeral = (bool)(getenv('VERCEL') || getenv('AWS_LAMBDA_FUNCTION_NAME'))
            && !(getenv('DATABASE_URL') || getenv('DB_HOST') || getenv('MYSQL_HOST'))
            && empty($envAccess);

        return [
            'enabled' => $enabled,
            'configured' => !empty($accessToken) && !empty($publicKey),
            'has_access_token' => !empty($accessToken),
            'has_public_key' => !empty($publicKey),
            'public_key' => $publicKey,
            'access_token' => $accessToken,
            'webhook_secret' => $webhookSec,
            'sandbox' => $sandboxFlag,
            'max_installments' => $maxInstallments,
            'source' => $source,
            'is_serverless_ephemeral' => $isServerlessEphemeral,
            'db_settings' => $dbSettings
        ];
    }

    /**
     * Ejecuta peticiones HTTP firmadas contra la API oficial de Mercado Pago.
     */
    public static function request(string $method, string $path, string $accessToken, ?array $body = null, ?string $idempotencyKey = null): array {
        if (empty($accessToken)) {
            return [
                'ok' => false,
                'http_code' => 401,
                'message' => 'Access Token de Mercado Pago no configurado.'
            ];
        }

        $url = self::API_BASE . $path;
        $headers = [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
            'User-Agent: ConviviaPetShop-MP-SDK/2.0-PHP'
        ];
        if (!empty($idempotencyKey)) {
            $headers[] = 'X-Idempotency-Key: ' . $idempotencyKey;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $upperMethod = strtoupper($method);
        if ($upperMethod === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body !== null ? json_encode($body) : '{}');
        } elseif ($upperMethod !== 'GET') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $upperMethod);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            }
        }

        $raw = curl_exec($ch);
        $httpCode = intval(curl_getinfo($ch, CURLINFO_HTTP_CODE));
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            return [
                'ok' => false,
                'http_code' => 0,
                'message' => 'Error de red conectando a Mercado Pago: ' . $curlErr
            ];
        }

        $data = json_decode($raw, true);
        $isOk = ($httpCode >= 200 && $httpCode < 300) && is_array($data);

        return [
            'ok' => $isOk,
            'http_code' => $httpCode,
            'data' => is_array($data) ? $data : null,
            'message' => !$isOk ? ($data['message'] ?? ($data['error'] ?? "HTTP $httpCode desde Mercado Pago")) : 'OK'
        ];
    }

    /**
     * Valida credenciales consultando /users/me en Mercado Pago.
     */
    public static function verifyToken(string $accessToken): array {
        return self::request('GET', '/users/me', $accessToken);
    }

    /**
     * Crea una Preferencia de Pago Checkout Pro / Payment Brick v2.
     */
    public static function createPreference(string $accessToken, array $payload): array {
        $idem = $payload['external_reference'] ?? ('pref_' . bin2hex(random_bytes(6)));
        return self::request('POST', '/checkout/preferences', $accessToken, $payload, $idem . '_' . time());
    }

    /**
     * Procesa un pago directo con token de tarjeta proveniente de Payment Brick v2 (/v1/payments).
     */
    public static function createPayment(string $accessToken, array $payload): array {
        $idem = ($payload['external_reference'] ?? 'pay') . '_' . ($payload['token'] ?? bin2hex(random_bytes(4))) . '_' . substr((string)microtime(true), -6);
        return self::request('POST', '/v1/payments', $accessToken, $payload, $idem);
    }

    /**
     * Consulta un pago por ID en la API v1 de Mercado Pago.
     */
    public static function getPayment(string $accessToken, string $paymentId): array {
        $cleanId = preg_replace('/[^0-9]/', '', $paymentId);
        if (empty($cleanId)) {
            return ['ok' => false, 'http_code' => 400, 'message' => 'ID de pago inválido'];
        }
        return self::request('GET', '/v1/payments/' . $cleanId, $accessToken);
    }

    /**
     * Consulta una merchant order por ID.
     */
    public static function getMerchantOrder(string $accessToken, string $orderId): array {
        $cleanId = preg_replace('/[^0-9]/', '', $orderId);
        if (empty($cleanId)) {
            return ['ok' => false, 'http_code' => 400, 'message' => 'ID de orden MP inválido'];
        }
        return self::request('GET', '/merchant_orders/' . $cleanId, $accessToken);
    }

    /**
     * Verifica firma HMAC-SHA256 oficial de Webhooks de Mercado Pago (x-signature).
     */
    public static function validateWebhookSignature(string $xSignature, string $xRequestId, string $dataId, string $secret): bool {
        if (empty($secret)) {
            return true; // Sin secret configurado, permitir verificación posterior directa vía API getPayment()
        }
        if (empty($xSignature) || empty($dataId)) {
            return false;
        }
        $ts = '';
        $v1 = '';
        foreach (explode(',', $xSignature) as $part) {
            $kv = explode('=', trim($part), 2);
            if (count($kv) === 2) {
                if ($kv[0] === 'ts') $ts = trim($kv[1]);
                if ($kv[0] === 'v1') $v1 = trim($kv[1]);
            }
        }
        if (empty($ts) || empty($v1)) {
            return false;
        }
        $manifest = "id:{$dataId};request-id:{$xRequestId};ts:{$ts};";
        $expected = hash_hmac('sha256', $manifest, $secret);
        return hash_equals($expected, $v1);
    }

    /**
     * Procesa un objeto Payment verificado desde la API y actualiza orden, stock, bitácora y Telegram.
     */
    public static function applyPaymentToOrder(PDO $pdo, array $payment, array $config): array {
        $paymentId = (string)($payment['id'] ?? '');
        $mpStatus  = strtolower(trim($payment['status'] ?? ''));
        $statusDetail = trim($payment['status_detail'] ?? '');
        $extRef = trim($payment['external_reference'] ?? ($payment['metadata']['order_number'] ?? ''));
        $amount = floatval($payment['transaction_amount'] ?? 0);
        $methodId = strtoupper($payment['payment_method_id'] ?? 'MP');
        $installments = intval($payment['installments'] ?? 1);
        $lastFour = $payment['card']['last_four_digits'] ?? '';

        if (empty($extRef) || empty($paymentId)) {
            return ['updated' => false, 'reason' => 'Sin external_reference o payment_id'];
        }

        $stmt = $pdo->prepare("SELECT * FROM orders WHERE order_number = :ref ORDER BY id DESC LIMIT 1");
        $stmt->execute(['ref' => $extRef]);
        $order = $stmt->fetch();

        if (!$order) {
            return ['updated' => false, 'reason' => "Orden {$extRef} no encontrada en base de datos"];
        }

        $orderId = intval($order['id']);
        $prevStatus = $order['status'];
        $existingNotes = trim($order['notes'] ?? '');

        $wasApproved = in_array($prevStatus, ['aprobado', 'confirmado', 'despachado', 'completado']);
        $newOrderStatus = $prevStatus;

        $cardInfo = $lastFour ? " (****{$lastFour}, {$installments} cuota" . ($installments > 1 ? 's' : '') . ")" : " ({$installments}x)";
        $timestamp = date('d/m/Y H:i:s');
        $logTag = "[MP #{$paymentId} {$mpStatus}]";

        if ($mpStatus === 'approved') {
            $newOrderStatus = 'aprobado';
            $logLine = "[{$timestamp}] 💳 Mercado Pago APROBADO (#{$paymentId} • {$methodId}{$cardInfo} • \$" . number_format($amount, 0, ',', '.') . ") {$logTag}";

            if (!$wasApproved) {
                $stmtItems = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = :oid");
                $stmtItems->execute(['oid' => $orderId]);
                foreach ($stmtItems->fetchAll() as $it) {
                    $stmtStock = $pdo->prepare("UPDATE products SET stock = CASE WHEN stock > :qty THEN stock - :qty ELSE 0 END WHERE id = :pid");
                    $stmtStock->execute(['qty' => $it['quantity'], 'pid' => $it['product_id']]);
                }
            }
        } elseif ($mpStatus === 'pending' || $mpStatus === 'in_process' || $mpStatus === 'authorized') {
            if (!$wasApproved) {
                $newOrderStatus = 'pendiente_validacion';
            }
            $logLine = "[{$timestamp}] ⏳ Mercado Pago en revisión (#{$paymentId} • {$statusDetail}) {$logTag}";
        } elseif ($mpStatus === 'refunded' || $mpStatus === 'charged_back') {
            $newOrderStatus = 'cancelado';
            $logLine = "[{$timestamp}] ↩️ Pago Mercado Pago reintegrado/contracargo (#{$paymentId}) {$logTag}";
            if ($wasApproved) {
                $stmtItems = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = :oid");
                $stmtItems->execute(['oid' => $orderId]);
                foreach ($stmtItems->fetchAll() as $it) {
                    $stmtStock = $pdo->prepare("UPDATE products SET stock = stock + :qty WHERE id = :pid");
                    $stmtStock->execute(['qty' => $it['quantity'], 'pid' => $it['product_id']]);
                }
            }
        } else {
            // rejected / cancelled
            $logLine = "[{$timestamp}] ⚠️ Intento Mercado Pago {$mpStatus} (#{$paymentId} • {$statusDetail}) {$logTag}";
        }

        // Evitar duplicar exactamente la misma entrada de log si el webhook reintenta
        $updatedNotes = $existingNotes;
        if (strpos($existingNotes, $logTag) === false) {
            $updatedNotes = $existingNotes ? ($existingNotes . "\n" . $logLine) : $logLine;
        }

        $stmtUpd = $pdo->prepare("UPDATE orders SET status = :st, mp_payment_id = :pid, mp_payment_status = :mpst, notes = :notes WHERE id = :id");
        $stmtUpd->execute([
            'st' => $newOrderStatus,
            'pid' => $paymentId,
            'mpst' => $mpStatus,
            'notes' => $updatedNotes,
            'id' => $orderId
        ]);

        syncAllDataMirrors($pdo);

        // Notificar por Telegram si acaba de aprobarse automáticamente por Mercado Pago
        if ($mpStatus === 'approved' && !$wasApproved) {
            self::notifyTelegramApproved($config['db_settings'] ?? [], $order, $paymentId, $methodId, $cardInfo, $amount);
        }

        return [
            'updated' => true,
            'order_id' => $orderId,
            'order_number' => $extRef,
            'order_status' => $newOrderStatus,
            'mp_payment_id' => $paymentId,
            'mp_status' => $mpStatus,
            'mp_status_detail' => $statusDetail,
            'newly_approved' => ($mpStatus === 'approved' && !$wasApproved)
        ];
    }

    private static function notifyTelegramApproved(array $dbSettings, array $order, string $paymentId, string $methodId, string $cardInfo, float $amount): void {
        $tgToken = getenv('TELEGRAM_BOT_TOKEN') ?: ($dbSettings['telegram_token'] ?? (defined('TELEGRAM_BOT_TOKEN') ? TELEGRAM_BOT_TOKEN : ''));
        $tgChatId = getenv('TELEGRAM_CHAT_ID') ?: ($dbSettings['telegram_chat_id'] ?? (defined('TELEGRAM_CHAT_ID') ? TELEGRAM_CHAT_ID : ''));
        $tgEnabled = ($dbSettings['telegram_enabled'] ?? '0') === '1' || (bool)getenv('TELEGRAM_BOT_TOKEN');

        if (!$tgEnabled || empty($tgToken) || empty($tgChatId)) {
            return;
        }

        $cleanWa = preg_replace('/[^0-9]/', '', $order['customer_whatsapp'] ?? '');
        $msg = "✅ <b>PAGO ACREDITADO VÍA MERCADO PAGO</b> 💳\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "📦 <b>Orden:</b> <code>{$order['order_number']}</code>\n";
        $msg .= "👤 <b>Cliente:</b> " . htmlspecialchars($order['customer_name'] ?? 'Cliente') . "\n";
        $msg .= "💰 <b>Monto:</b> \$" . number_format($amount, 2, ',', '.') . "\n";
        $msg .= "💳 <b>Medio:</b> {$methodId}{$cardInfo}\n";
        $msg .= "🆔 <b>Operación MP:</b> <code>#{$paymentId}</code>\n";
        $msg .= "🚚 <b>Entrega:</b> " . htmlspecialchars(($order['delivery_date'] ?? '') . ' | ' . ($order['delivery_time_slot'] ?? '')) . "\n\n";
        $msg .= "✓ <i>Estado actualizado a APROBADO y stock descontado automáticamente.</i>";

        $url = "https://api.telegram.org/bot" . $tgToken . "/sendMessage";
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'chat_id' => $tgChatId,
            'text' => $msg,
            'parse_mode' => 'HTML',
            'reply_markup' => json_encode([
                'inline_keyboard' => [
                    [['text' => '💬 Contactar por WhatsApp', 'url' => "https://wa.me/{$cleanWa}"]]
                ]
            ])
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        @curl_exec($ch);
        @curl_close($ch);
    }
}
