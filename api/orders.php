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
    $stmt = $pdo->query("SELECT * FROM orders ORDER BY id DESC LIMIT 50");
    $orders = $stmt->fetchAll();

    foreach ($orders as &$ord) {
        $ord['total'] = floatval($ord['total']);
        $ord['subtotal'] = floatval($ord['subtotal']);
        $ord['discount_amount'] = floatval($ord['discount_amount']);
        $ord['shipping_cost'] = floatval($ord['shipping_cost'] ?? 0);

        $stmtItems = $pdo->prepare("SELECT * FROM order_items WHERE order_id = :order_id");
        $stmtItems->execute(['order_id' => $ord['id']]);
        $ord['items'] = $stmtItems->fetchAll();
    }

    echo json_encode([
        'status' => 'success',
        'orders' => $orders
    ]);
    exit;
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

        $stmt = $pdo->prepare("UPDATE orders SET status = :status WHERE id = :id");
        $stmt->execute(['status' => $newStatus, 'id' => $orderId]);

        echo json_encode(['status' => 'success', 'message' => "Estado actualizado a '{$newStatus}'"]);
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
