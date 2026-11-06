<?php
// api/orders.php - Gestión de Pedidos, Comprobantes y Notificaciones
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/sync.php';
$pdo = getDBConnection();

$rawInput = file_get_contents('php://input');
$jsonInput = !empty($rawInput) ? json_decode($rawInput, true) : null;
$input = is_array($jsonInput) ? $jsonInput : $_POST;

$action = $_GET['action'] ?? $_POST['action'] ?? ($input['action'] ?? 'list');

if ($action === 'list') {
    // Listar todos los pedidos con sus ítems
    $orders = [];
    try {
        $stmt = $pdo->query("SELECT * FROM orders ORDER BY id DESC LIMIT 50");
        $orders = $stmt ? $stmt->fetchAll() : [];

        foreach ($orders as &$ord) {
            $ord['total'] = floatval($ord['total']);
            $ord['subtotal'] = floatval($ord['subtotal']);
            $ord['discount_amount'] = floatval($ord['discount_amount']);
            $ord['shipping_cost'] = floatval($ord['shipping_cost'] ?? 0);

            $stmtItems = $pdo->prepare("SELECT * FROM order_items WHERE order_id = :order_id");
            $stmtItems->execute(['order_id' => $ord['id']]);
            $ord['items'] = $stmtItems->fetchAll();
        }
    } catch (Exception $e) {
        $orders = [];
    }

    // Fallback de alta disponibilidad a assets/data/orders.json si la DB está vacía (ej. contenedor serverless efímero)
    if (empty($orders)) {
        $ordersJsonFile = __DIR__ . '/../assets/data/orders.json';
        if (file_exists($ordersJsonFile)) {
            $jsonData = json_decode(file_get_contents($ordersJsonFile), true);
            if ($jsonData && !empty($jsonData['orders'])) {
                $orders = $jsonData['orders'];
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'orders' => $orders
    ]);
    exit;
}

if ($action === 'track') {
    $query = trim($_GET['order'] ?? ($_GET['order_number'] ?? ($_GET['whatsapp'] ?? ($_GET['phone'] ?? ($_GET['q'] ?? ($input['order'] ?? ($input['order_number'] ?? ($input['whatsapp'] ?? ($input['phone'] ?? ($input['q'] ?? ''))))))))));
    if (empty($query)) {
        echo json_encode(['status' => 'error', 'message' => 'Ingresa tu número de pedido o teléfono']);
        exit;
    }

    $cleanPhone = preg_replace('/[^0-9]/', '', $query);

    $stmt = $pdo->prepare("SELECT id, order_number, customer_name, customer_whatsapp, payment_method, 
                                  subtotal, discount_amount, total, status, delivery_date, delivery_time_slot, 
                                  shipping_zone, shipping_cost, pet_name, pet_type, notes, created_at 
                           FROM orders 
                           WHERE order_number = :q OR (:p != '' AND REPLACE(REPLACE(REPLACE(customer_whatsapp, ' ', ''), '-', ''), '+', '') LIKE :phonePattern)
                           ORDER BY id DESC LIMIT 1");
    $stmt->execute([
        'q' => $query,
        'p' => $cleanPhone,
        'phonePattern' => "%$cleanPhone%"
    ]);
    $order = $stmt->fetch();

    if (!$order) {
        echo json_encode(['status' => 'error', 'message' => 'No encontramos un pedido con esos datos. Verificá el código o tu número de WhatsApp.']);
        exit;
    }

    $stmtItems = $pdo->prepare("SELECT product_name, weight_kg, quantity, unit_price, subtotal FROM order_items WHERE order_id = :oid");
    $stmtItems->execute(['oid' => $order['id']]);
    $order['items'] = $stmtItems->fetchAll();

    $logs = [];
    if (!empty($order['notes'])) {
        $lines = explode("\n", $order['notes']);
        foreach ($lines as $ln) {
            $ln = trim($ln);
            if (!empty($ln) && strpos($ln, '[') === 0 && strpos($ln, ']') !== false) {
                $logs[] = $ln;
            }
        }
    }
    $order['logs'] = $logs;

    $statusMap = [
        'pendiente_comprobante' => ['label' => 'Esperando Comprobante', 'step' => 1, 'badge' => 'bg-amber-500/20 text-amber-300 border-amber-500/40', 'icon' => '⏳', 'desc' => 'Estamos a la espera de la transferencia o pago para procesar la orden.'],
        'pendiente_validacion' => ['label' => 'Validando Pago', 'step' => 2, 'badge' => 'bg-blue-500/20 text-blue-300 border-blue-500/40', 'icon' => '🔍', 'desc' => 'Comprobante recibido. Administración está confirmando el ingreso en cuenta.'],
        'aprobado' => ['label' => 'Pago Aprobado & Stock Reservado', 'step' => 3, 'badge' => 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', 'icon' => '✓', 'desc' => '¡Tu pago está confirmado! La bolsa ya está reservada y en preparación.'],
        'confirmado' => ['label' => 'En Preparación de Reparto', 'step' => 3, 'badge' => 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', 'icon' => '📦', 'desc' => 'Tu pedido está embalado y listo para salir con el repartidor.'],
        'despachado' => ['label' => 'En Camino a tu Domicilio', 'step' => 4, 'badge' => 'bg-purple-500/20 text-purple-300 border-purple-500/40', 'icon' => '🚚', 'desc' => 'El repartidor está en viaje en la franja solicitada.'],
        'completado' => ['label' => 'Entregado con Éxito', 'step' => 5, 'badge' => 'bg-emerald-500/30 text-emerald-200 border-emerald-500/50', 'icon' => '🏠', 'desc' => 'Pedido entregado. ¡Muchas gracias por confiar en CONVIVIA!'],
        'cancelado' => ['label' => 'Pedido Cancelado', 'step' => 0, 'badge' => 'bg-rose-500/20 text-rose-300 border-rose-500/40', 'icon' => '✕', 'desc' => 'Este pedido fue cancelado.']
    ];
    $order['status_info'] = $statusMap[$order['status']] ?? ['label' => ucfirst($order['status']), 'step' => 1, 'badge' => 'bg-gray-500/20 text-gray-300', 'icon' => '📋', 'desc' => 'En seguimiento'];

    if (!empty($order['customer_whatsapp'])) {
        $order['customer_whatsapp'] = substr($order['customer_whatsapp'], 0, 4) . '****' . substr($order['customer_whatsapp'], -2);
    }

    $order['status_label'] = $order['status_info']['label'];
    $order['tracking_step'] = $order['status_info']['step'];
    $order['status_badge_class'] = $order['status_info']['badge'];
    $order['customer_whatsapp_masked'] = $order['customer_whatsapp'];
    $order['tracking_logs'] = [];
    foreach ($logs as $l) {
        $order['tracking_logs'][] = ['text' => $l, 'timestamp' => ''];
    }

    echo json_encode([
        'status' => 'success',
        'order' => $order
    ]);
    exit;
}

if ($action === 'clear_all' || $action === 'purge_test_orders') {
    try {
        $pdo->exec("DELETE FROM order_items");
        $pdo->exec("DELETE FROM orders");
        try { $pdo->exec("DELETE FROM telegram_notifications"); } catch(Exception $e) {}
        try { $pdo->exec("ALTER TABLE orders AUTO_INCREMENT = 1"); } catch(Exception $e) {}
        try { $pdo->exec("ALTER TABLE order_items AUTO_INCREMENT = 1"); } catch(Exception $e) {}
        syncAllDataMirrors($pdo);
        echo json_encode([
            'status' => 'success',
            'message' => 'Pedidos y registros predictivos purgados exitosamente para producción.'
        ]);
        exit;
    } catch(Exception $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        exit;
    }
}

if ($action === 'update_status') {
    $orderId = intval($input['order_id'] ?? 0);
    $newStatus = trim($input['status'] ?? '');

    $allowedStatuses = ['pendiente_comprobante', 'pendiente_validacion', 'aprobado', 'confirmado', 'despachado', 'completado', 'rechazado', 'cancelado'];

    if ($orderId > 0 && in_array($newStatus, $allowedStatuses)) {
        // Obtener el estado anterior
        $stmtPrev = $pdo->prepare("SELECT status FROM orders WHERE id = :id");
        $stmtPrev->execute(['id' => $orderId]);
        $prevStatus = $stmtPrev->fetchColumn();

        $isNowApproved = in_array($newStatus, ['aprobado', 'confirmado', 'despachado', 'completado']);
        $wasApproved = in_array($prevStatus, ['aprobado', 'confirmado', 'despachado', 'completado']);

        // Si pasa a aprobado/confirmado y antes no lo estaba, descontar stock de los productos
        if ($isNowApproved && !$wasApproved) {
            $stmtItems = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = :order_id");
            $stmtItems->execute(['order_id' => $orderId]);
            $items = $stmtItems->fetchAll();

            foreach ($items as $it) {
                $stmtStock = $pdo->prepare("UPDATE products SET stock = CASE WHEN stock > :qty THEN stock - :qty ELSE 0 END WHERE id = :pid");
                $stmtStock->execute(['qty' => $it['quantity'], 'pid' => $it['product_id']]);
            }
            syncAllDataMirrors($pdo);
        }

        // Si estaba aprobado/confirmado y se cancela o rechaza, reintegrar el stock
        if (($newStatus === 'cancelado' || $newStatus === 'rechazado') && $wasApproved) {
            $stmtItems = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = :order_id");
            $stmtItems->execute(['order_id' => $orderId]);
            $items = $stmtItems->fetchAll();

            foreach ($items as $it) {
                $stmtStock = $pdo->prepare("UPDATE products SET stock = stock + :qty WHERE id = :pid");
                $stmtStock->execute(['qty' => $it['quantity'], 'pid' => $it['product_id']]);
            }
            syncAllDataMirrors($pdo);
        }

        $logEntry = trim($input['log_entry'] ?? '');
        if ($logEntry !== '') {
            $stmtNotes = $pdo->prepare("SELECT notes FROM orders WHERE id = :id");
            $stmtNotes->execute(['id' => $orderId]);
            $existing = trim($stmtNotes->fetchColumn() ?: '');
            $updatedNotes = $existing ? ($existing . "\n" . $logEntry) : $logEntry;
            $stmt = $pdo->prepare("UPDATE orders SET status = :status, notes = :notes WHERE id = :id");
            $stmt->execute(['status' => $newStatus, 'notes' => $updatedNotes, 'id' => $orderId]);
        } else {
            $stmt = $pdo->prepare("UPDATE orders SET status = :status WHERE id = :id");
            $stmt->execute(['status' => $newStatus, 'id' => $orderId]);
        }
        syncAllDataMirrors($pdo);

        echo json_encode(['status' => 'success', 'message' => "Estado actualizado a '{$newStatus}'"]);
        exit;
    }

    echo json_encode(['status' => 'error', 'message' => 'Parámetros inválidos']);
    exit;
}

if ($action === 'log_action') {
    $orderId = intval($input['order_id'] ?? 0);
    $logEntry = trim($input['log_entry'] ?? '');
    if ($orderId > 0 && $logEntry !== '') {
        $stmtNotes = $pdo->prepare("SELECT notes FROM orders WHERE id = :id");
        $stmtNotes->execute(['id' => $orderId]);
        $existing = trim($stmtNotes->fetchColumn() ?: '');
        $updatedNotes = $existing ? ($existing . "\n" . $logEntry) : $logEntry;
        $pdo->prepare("UPDATE orders SET notes = :notes WHERE id = :id")->execute(['notes' => $updatedNotes, 'id' => $orderId]);
        syncAllDataMirrors($pdo);
        echo json_encode(['status' => 'success', 'notes' => $updatedNotes]);
        exit;
    }
    echo json_encode(['status' => 'error', 'message' => 'Parámetros inválidos']);
    exit;
}

if ($action === 'create_manual') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $customerName = trim($input['customer_name'] ?? 'Cliente Venta Rápida');
    $customerWhatsapp = trim($input['customer_whatsapp'] ?? '');
    $customerAddress = trim($input['customer_address'] ?? 'Bahía Blanca');
    $shippingZone = trim($input['shipping_zone'] ?? 'Bahía Blanca / Local');
    $deliveryTimeSlot = trim($input['delivery_time_slot'] ?? 'Horario a coordinar');
    $deliveryDate = trim($input['delivery_date'] ?? date('Y-m-d'));
    $paymentMethod = trim($input['payment_method'] ?? 'transferencia');
    $status = trim($input['status'] ?? 'pendiente_validacion');
    $notes = trim($input['notes'] ?? 'Ingresado desde Mini-POS');
    $items = $input['items'] ?? [];

    if (empty($items) || !is_array($items)) {
        echo json_encode(['status' => 'error', 'message' => 'El pedido debe contener al menos un producto']);
        exit;
    }

    $subtotal = 0;
    $orderItemsData = [];
    foreach ($items as $it) {
        $pId = intval($it['product_id'] ?? 0);
        $qty = max(1, intval($it['quantity'] ?? 1));
        $unitPrice = floatval($it['unit_price'] ?? 0);
        $itemSubtotal = $unitPrice * $qty;
        $subtotal += $itemSubtotal;

        $orderItemsData[] = [
            'product_id' => $pId,
            'product_name' => trim($it['product_name'] ?? 'Alimento'),
            'weight_kg' => floatval($it['weight_kg'] ?? 15),
            'quantity' => $qty,
            'unit_price' => $unitPrice,
            'subtotal' => $itemSubtotal
        ];
    }

    $discountAmount = floatval($input['discount_amount'] ?? 0);
    $shippingCost = floatval($input['shipping_cost'] ?? 0);
    $total = max(0, $subtotal - $discountAmount + $shippingCost);
    $orderNumber = 'PW-' . strtoupper(substr(uniqid(), -5));

    $stmt = $pdo->prepare("INSERT INTO orders (order_number, customer_name, customer_whatsapp, customer_address, shipping_zone, delivery_time_slot, delivery_date, payment_method, subtotal, discount_amount, shipping_cost, total, status, notes, created_at) 
                           VALUES (:num, :name, :wa, :addr, :zone, :slot, :ddate, :pm, :sub, :disc, :ship, :tot, :st, :notes, CURRENT_TIMESTAMP)");
    $stmt->execute([
        'num' => $orderNumber,
        'name' => $customerName,
        'wa' => $customerWhatsapp,
        'addr' => $customerAddress,
        'zone' => $shippingZone,
        'slot' => $deliveryTimeSlot,
        'ddate' => $deliveryDate,
        'pm' => $paymentMethod,
        'sub' => $subtotal,
        'disc' => $discountAmount,
        'ship' => $shippingCost,
        'tot' => $total,
        'st' => $status,
        'notes' => $notes
    ]);
    $orderId = $pdo->lastInsertId();

    $stmtItem = $pdo->prepare("INSERT INTO order_items (order_id, product_id, product_name, weight_kg, quantity, unit_price, subtotal) 
                               VALUES (:oid, :pid, :pname, :w, :qty, :up, :sub)");
    foreach ($orderItemsData as $oid) {
        $stmtItem->execute([
            'oid' => $orderId,
            'pid' => $oid['product_id'],
            'pname' => $oid['product_name'],
            'w' => $oid['weight_kg'],
            'qty' => $oid['quantity'],
            'up' => $oid['unit_price'],
            'sub' => $oid['subtotal']
        ]);

        if ($status === 'aprobado' && $oid['product_id'] > 0) {
            $pdo->prepare("UPDATE products SET stock = CASE WHEN stock > :q THEN stock - :q ELSE 0 END WHERE id = :pid")->execute(['q' => $oid['quantity'], 'pid' => $oid['product_id']]);
        }
    }

    syncAllDataMirrors($pdo);

    echo json_encode([
        'status' => 'success',
        'message' => "Pedido {$orderNumber} registrado con éxito",
        'order_id' => $orderId,
        'order_number' => $orderNumber
    ]);
    exit;
}

if ($action === 'latest_telegram') {
    // Obtener la última notificación para el visor del centro de mando
    $stmt = $pdo->query("SELECT tn.*, o.order_number, o.customer_name, o.total, o.receipt_path, o.status as order_status 
                         FROM telegram_notifications tn 
                         LEFT JOIN orders o ON tn.order_id = o.id 
                         ORDER BY tn.id DESC LIMIT 1");
    $latest = $stmt->fetch();

    echo json_encode([
        'status' => 'success',
        'notification' => $latest ?: null
    ]);
    exit;
}
