<?php
// api/checkout.php - Endpoint de Procesamiento de Checkout con Horario Conforme y Multi-Mascota
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/config.php';

$pdo = getDBConnection();

$settingsRows = $pdo->query("SELECT setting_key, setting_value FROM settings")->fetchAll();
$dynSettings = [];
foreach ($settingsRows as $sr) {
    $dynSettings[$sr['setting_key']] = $sr['setting_value'];
}

$bankName = $dynSettings['bank_name'] ?? BANK_NAME;
$bankHolder = $dynSettings['bank_holder'] ?? BANK_HOLDER;
$bankCuit = $dynSettings['bank_cuit'] ?? BANK_CUIT;
$bankAlias = $dynSettings['bank_alias'] ?? BANK_ALIAS;
$bankCbu = $dynSettings['bank_cbu'] ?? BANK_CBU;
$freeShippingThreshold = floatval($dynSettings['free_shipping_threshold'] ?? 60000);

$tgToken = $dynSettings['telegram_token'] ?? TELEGRAM_BOT_TOKEN;
$tgChatId = $dynSettings['telegram_chat_id'] ?? TELEGRAM_CHAT_ID;
$tgEnabled = ($dynSettings['telegram_enabled'] ?? (TELEGRAM_ENABLED ? '1' : '0')) === '1';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Método no permitido']);
    exit;
}

$customerName = trim($_POST['customer_name'] ?? '');
$customerWhatsapp = trim($_POST['customer_whatsapp'] ?? '');
$customerEmail = trim($_POST['customer_email'] ?? '');
$customerAddress = trim($_POST['customer_address'] ?? '');
$paymentMethod = trim($_POST['payment_method'] ?? $_POST['checkout_payment'] ?? 'transferencia');
$cartItemsRaw = $_POST['cart_items'] ?? '[]';

// Multi-Mascota (Perro y/o Gato)
$petType = trim($_POST['pet_type'] ?? 'perro'); // perro, gato, ambos
$petName = trim($_POST['pet_name'] ?? '');
$petWeight = floatval($_POST['pet_weight'] ?? 0);
$catName = trim($_POST['cat_name'] ?? '');
$catWeight = floatval($_POST['cat_weight'] ?? 0);

// Horario Conforme y Zona de Envío
$deliveryDate = trim($_POST['delivery_date'] ?? date('Y-m-d'));
$deliveryTimeSlot = trim($_POST['delivery_time_slot'] ?? '09:00 a 13:00 hs (Mañana)');
$shippingZone = trim($_POST['shipping_zone'] ?? 'Bahía Blanca / Local');
$shippingCost = floatval($_POST['shipping_cost'] ?? 0);

$notes = trim($_POST['notes'] ?? '');
$petBirthday = trim($_POST['pet_birthday'] ?? '');
if (!empty($petBirthday)) {
    $notes = trim($notes . " [🎂 Cumple/Adopción Mascota: " . $petBirthday . "]");
}

if (empty($customerName) || empty($customerWhatsapp) || empty($customerAddress)) {
    echo json_encode(['status' => 'error', 'message' => 'Por favor completa Nombre, WhatsApp y Dirección de entrega.']);
    exit;
}

$cartItems = json_decode($cartItemsRaw, true);
if (empty($cartItems) || !is_array($cartItems)) {
    echo json_encode(['status' => 'error', 'message' => 'El carrito está vacío.']);
    exit;
}

// Procesar Comprobante si se adjuntó
$receiptPath = null;
$receiptPublicUrl = null;
if (isset($_FILES['receipt']) && $_FILES['receipt']['error'] === UPLOAD_ERR_OK) {
    $fileTmp = $_FILES['receipt']['tmp_name'];
    $fileName = $_FILES['receipt']['name'];
    $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

    if (in_array($fileExt, $allowed)) {
        $safeName = 'comp_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $fileExt;
        $destPath = UPLOAD_DIR . $safeName;
        if (move_uploaded_file($fileTmp, $destPath)) {
            $receiptPath = 'uploads/comprobantes/' . $safeName;
            $receiptPublicUrl = APP_URL . '/' . $receiptPath;
        }
    }
}

$subtotal = 0;
$itemsTotal = 0;
$discountAmount = 0;
$processedItems = [];
$totalWeight = 0;

$rawGenEnabled = $dynSettings['discount_transfer_enabled'] ?? '1';
$generalDiscount = floatval($dynSettings['discount_transfer_percent'] ?? 10);
$generalEnabled = ($rawGenEnabled === '1' || $rawGenEnabled === 1 || $rawGenEnabled === true) && $generalDiscount > 0;

foreach ($cartItems as $item) {
    $pId = intval($item['id'] ?? 0);
    $qty = max(1, intval($item['quantity'] ?? 1));

    $stmt = $pdo->prepare("SELECT * FROM products WHERE id = :id");
    $stmt->execute(['id' => $pId]);
    $product = $stmt->fetch();

    if ($product) {
        $priceList = floatval($product['price_list']);
        $weight = floatval($product['weight_kg']);

        // 1. Detectar si el producto tiene oferta individual manual desde el panel
        $hasManualPref = isset($product['precio_preferencial']) && $product['precio_preferencial'] !== null && floatval($product['precio_preferencial']) > 0 && floatval($product['precio_preferencial']) < $priceList;
        $hasManualDisc = isset($product['discount_percent']) && $product['discount_percent'] !== null && $product['discount_percent'] !== '';

        if ($hasManualPref) {
            // Oferta individual con precio fijo
            $pricePromo = floatval($product['precio_preferencial']);
        } elseif ($hasManualDisc && floatval($product['discount_percent']) > 0) {
            // Oferta individual con porcentaje manual
            $effDisc = max(0.0, min(100.0, floatval($product['discount_percent'])));
            $pricePromo = round($priceList * ((100.0 - $effDisc) / 100.0), 2);
        } elseif ($hasManualDisc && floatval($product['discount_percent']) == 0) {
            // Configurado explícitamente sin descuento
            $pricePromo = $priceList;
        } else {
            // Estándar: hereda el general SOLO si está activado y es > 0
            $effDisc = $generalEnabled ? max(0.0, min(100.0, $generalDiscount)) : 0.0;
            $pricePromo = round($priceList * ((100.0 - $effDisc) / 100.0), 2);
        }

        $unitPrice = ($paymentMethod === 'transferencia' || $paymentMethod === 'efectivo') ? $pricePromo : $priceList;
        $itemSubtotal = $unitPrice * $qty;

        $subtotal += ($priceList * $qty);
        $itemsTotal += $itemSubtotal;
        $totalWeight += ($weight * $qty);

        $processedItems[] = [
            'product_id' => $product['id'],
            'name' => $product['name'],
            'weight_kg' => $weight,
            'quantity' => $qty,
            'unit_price' => $unitPrice,
            'subtotal' => $itemSubtotal,
            'is_pack' => $isPack,
            'used_pref_price' => $hasPrefPrice,
            'beneficio_exclusivo' => $product['beneficio_exclusivo'] ?? null
        ];
    }
}

if (empty($processedItems)) {
    echo json_encode(['status' => 'error', 'message' => 'No se encontraron productos válidos en el carrito.']);
    exit;
}

$discountAmount = max(0, $subtotal - $itemsTotal);

// Si supera la meta de envío gratis, el costo base de envío se bonifica
$appliedShippingCost = $shippingCost;
if ($itemsTotal >= $freeShippingThreshold && $shippingCost > 0) {
    // Si supera envío gratis pero es zona lejana (zona 3 o 4), descuenta el valor de zona local o aplica bonificación
    $appliedShippingCost = max(0, $shippingCost - 2500); 
}

$total = $itemsTotal + $appliedShippingCost;
$orderNumber = 'PW-' . strtoupper(bin2hex(random_bytes(3))) . '-' . date('dmy');
$orderStatus = $receiptPath ? 'pendiente_validacion' : 'pendiente_comprobante';

// Cálculo de próxima fecha para el algoritmo Smart Bowl
$estimatedNextOrder = null;
$effectiveWeight = max($petWeight, $catWeight);
if ($effectiveWeight > 0 && $totalWeight > 0) {
    $dailyGrams = max(40, round($effectiveWeight * 12.0));
    $durationDays = max(5, round(($totalWeight * 1000) / $dailyGrams));
    $triggerDay = max(1, $durationDays - 5);
    $estimatedDate = (new DateTime())->modify("+$triggerDay days");
    $estimatedNextOrder = $estimatedDate->format('Y-m-d');
}

$stmt = $pdo->prepare("INSERT INTO orders 
    (order_number, customer_name, customer_whatsapp, customer_email, customer_address, payment_method, subtotal, discount_amount, total, receipt_path, status, pet_type, pet_name, pet_weight, cat_name, cat_weight, delivery_date, delivery_time_slot, shipping_zone, shipping_cost, estimated_next_order, notes)
    VALUES
    (:order_number, :customer_name, :customer_whatsapp, :customer_email, :customer_address, :payment_method, :subtotal, :discount_amount, :total, :receipt_path, :status, :pet_type, :pet_name, :pet_weight, :cat_name, :cat_weight, :delivery_date, :delivery_time_slot, :shipping_zone, :shipping_cost, :estimated_next_order, :notes)");

$stmt->execute([
    'order_number' => $orderNumber,
    'customer_name' => $customerName,
    'customer_whatsapp' => $customerWhatsapp,
    'customer_email' => $customerEmail,
    'customer_address' => $customerAddress,
    'payment_method' => $paymentMethod,
    'subtotal' => $subtotal,
    'discount_amount' => $discountAmount,
    'total' => $total,
    'receipt_path' => $receiptPath,
    'status' => $orderStatus,
    'pet_type' => $petType,
    'pet_name' => $petName,
    'pet_weight' => $petWeight,
    'cat_name' => $catName,
    'cat_weight' => $catWeight,
    'delivery_date' => $deliveryDate,
    'delivery_time_slot' => $deliveryTimeSlot,
    'shipping_zone' => $shippingZone,
    'shipping_cost' => $appliedShippingCost,
    'estimated_next_order' => $estimatedNextOrder,
    'notes' => $notes
]);

$orderId = $pdo->lastInsertId();

$stmtItem = $pdo->prepare("INSERT INTO order_items 
    (order_id, product_id, product_name, weight_kg, quantity, unit_price, subtotal)
    VALUES
    (:order_id, :product_id, :product_name, :weight_kg, :quantity, :unit_price, :subtotal)");

foreach ($processedItems as $item) {
    $stmtItem->execute([
        'order_id' => $orderId,
        'product_id' => $item['product_id'],
        'product_name' => $item['name'],
        'weight_kg' => $item['weight_kg'],
        'quantity' => $item['quantity'],
        'unit_price' => $item['unit_price'],
        'subtotal' => $item['subtotal']
    ]);

    // Descuento Inteligente de Stock (Packs Funcionales y Productos Individuales)
    if (!empty($item['is_pack'])) {
        // Descontar componentes vinculados en pack_items
        $stmtBundle = $pdo->prepare("SELECT product_id, quantity FROM pack_items WHERE pack_id = :pack_id");
        $stmtBundle->execute(['pack_id' => $item['product_id']]);
        $bundledComponents = $stmtBundle->fetchAll();
        if (!empty($bundledComponents)) {
            $stmtSubStock = $pdo->prepare("UPDATE products SET stock = GREATEST(0, stock - :dec_qty) WHERE id = :item_id");
            foreach ($bundledComponents as $bc) {
                $totalDec = intval($bc['quantity']) * intval($item['quantity']);
                $stmtSubStock->execute(['dec_qty' => $totalDec, 'item_id' => $bc['product_id']]);
            }
        }
    }
    // Descontar stock directo del producto / pack
    $pdo->prepare("UPDATE products SET stock = GREATEST(0, stock - :qty) WHERE id = :id")
        ->execute(['qty' => $item['quantity'], 'id' => $item['product_id']]);
}

// Notificación interna (Telegram bot en background)
$cleanWa = preg_replace('/[^0-9]/', '', $customerWhatsapp);
$telegramMsg = "🔔 *¡NUEVA ORDEN RECIBIDA!* `{$orderNumber}`\n";
$telegramMsg .= "━━━━━━━━━━━━━━━━━━━━━━\n";
$telegramMsg .= "👤 *Cliente:* {$customerName}\n";
$telegramMsg .= "📱 *WhatsApp:* [Chat directo](https://wa.me/{$cleanWa})\n";
$telegramMsg .= "📍 *Dirección:* {$customerAddress}\n";
$telegramMsg .= "🚚 *Zona:* {$shippingZone} (+\$" . number_format($appliedShippingCost, 0, ',', '.') . ")\n";
$telegramMsg .= "⏰ *Horario Conforme:* {$deliveryDate} | {$deliveryTimeSlot}\n";
$telegramMsg .= "💳 *Método:* " . strtoupper($paymentMethod) . "\n";

if ($petName || $catName) {
    $petDetails = [];
    if ($petName) $petDetails[] = "🐕 {$petName} ({$petWeight}kg)";
    if ($catName) $petDetails[] = "🐈 {$catName} ({$catWeight}kg)";
    $telegramMsg .= "🐾 *Mascotas:* " . implode(' | ', $petDetails) . "\n";
}

$telegramMsg .= "━━━━━━━━━━━━━━━━━━━━━━\n";
$telegramMsg .= "*Ítems:*\n";
foreach ($processedItems as $it) {
    $itemLine = "• {$it['quantity']}x {$it['name']} (\$" . number_format($it['subtotal'], 2, ',', '.') . ")";
    if (!empty($it['is_pack'])) {
        $itemLine .= "\n  📦 *[COMBO / PACK FUNCIONAL]*";
    }
    if (!empty($it['used_pref_price'])) {
        $itemLine .= "\n  ⭐ *[PRECIO PREFERENCIAL APLICADO]*";
    }
    if (!empty($it['beneficio_exclusivo'])) {
        $itemLine .= "\n  ✨ *Beneficio:* {$it['beneficio_exclusivo']}";
    }
    $telegramMsg .= $itemLine . "\n";
}
$telegramMsg .= "━━━━━━━━━━━━━━━━━━━━━━\n";
if ($discountAmount > 0) {
    $telegramMsg .= "🎁 *Ahorro Transferencia:* -\$" . number_format($discountAmount, 2, ',', '.') . "\n";
}
if ($appliedShippingCost > 0) {
    $telegramMsg .= "🚚 *Costo de Envío:* +\$" . number_format($appliedShippingCost, 2, ',', '.') . "\n";
}
$telegramMsg .= "💰 *TOTAL FINAL: \$" . number_format($total, 2, ',', '.') . "*\n\n";

if ($receiptPath) {
    $telegramMsg .= "📄 *Comprobante adjuntado:* [Ver comprobante]({$receiptPublicUrl})\n";
    $telegramMsg .= "ESTADO: ⏳ *Pendiente de validación*";
} else {
    $telegramMsg .= "⚠️ *Pendiente de comprobante*";
}

$stmtLog = $pdo->prepare("INSERT INTO telegram_notifications (order_id, message_text, status, receipt_url) VALUES (:order_id, :msg, :status, :receipt)");
$stmtLog->execute([
    'order_id' => $orderId,
    'msg' => $telegramMsg,
    'status' => $tgEnabled ? 'pending' : 'logged',
    'receipt' => $receiptPublicUrl
]);

if ($tgEnabled && !empty($tgToken) && !empty($tgChatId)) {
    try {
        $tgUrl = "https://api.telegram.org/bot" . $tgToken . "/sendMessage";
        $postData = [
            'chat_id' => $tgChatId,
            'text' => $telegramMsg,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode([
                'inline_keyboard' => [
                    [
                        ['text' => '✅ Aprobar Pago', 'callback_data' => 'approve_' . $orderId],
                        ['text' => '💬 Contactar Cliente', 'url' => "https://wa.me/{$cleanWa}"]
                    ]
                ]
            ])
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $tgUrl);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_exec($ch);
        curl_close($ch);
    } catch (Exception $e) {
        // Silencioso
    }
}

echo json_encode([
    'status' => 'success',
    'order' => [
        'id' => $orderId,
        'order_number' => $orderNumber,
        'total' => $total,
        'total_formatted' => '$' . number_format($total, 2, ',', '.'),
        'subtotal' => $subtotal,
        'items_total' => $itemsTotal,
        'shipping_cost' => $appliedShippingCost,
        'shipping_zone' => $shippingZone,
        'delivery_date' => $deliveryDate,
        'delivery_time_slot' => $deliveryTimeSlot,
        'discount_amount' => $discountAmount,
        'payment_method' => $paymentMethod,
        'pet_type' => $petType,
        'pet_name' => $petName,
        'pet_weight' => $petWeight,
        'cat_name' => $catName,
        'cat_weight' => $catWeight,
        'status' => $orderStatus,
        'receipt_url' => $receiptPublicUrl,
        'estimated_next_order' => $estimatedNextOrder,
        'bank_details' => [
            'bank' => $bankName,
            'holder' => $bankHolder,
            'cuit' => $bankCuit,
            'alias' => $bankAlias,
            'cbu' => $bankCbu,
            'qr_code_data' => "00020101021243650016com.mercadolibre0129https://mpago.la/pos/alias/" . $bankAlias
        ]
    ]
]);
