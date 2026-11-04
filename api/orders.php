<?php
// api/orders.php - Gestión de Pedidos, Comprobantes y Notificaciones
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/database.php';
$pdo = getDBConnection();

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

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
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $orderId = intval($input['order_id'] ?? 0);
    $newStatus = trim($input['status'] ?? '');

    $allowedStatuses = ['pendiente_comprobante', 'pendiente_validacion', 'aprobado', 'despachado', 'rechazado', 'cancelado'];

    if ($orderId > 0 && in_array($newStatus, $allowedStatuses)) {
        // Obtener el estado anterior
        $stmtPrev = $pdo->prepare("SELECT status FROM orders WHERE id = :id");
        $stmtPrev->execute(['id' => $orderId]);
        $prevStatus = $stmtPrev->fetchColumn();

        // Si pasa a aprobado, descontar stock de los productos
        if ($newStatus === 'aprobado' && $prevStatus !== 'aprobado') {
            $stmtItems = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = :order_id");
            $stmtItems->execute(['order_id' => $orderId]);
            $items = $stmtItems->fetchAll();

            foreach ($items as $it) {
                $stmtStock = $pdo->prepare("UPDATE products SET stock = GREATEST(0, stock - :qty) WHERE id = :pid");
                $stmtStock->execute(['qty' => $it['quantity'], 'pid' => $it['product_id']]);
            }
        }

        // Si estaba aprobado y se cancela o rechaza, reintegrar el stock
        if (($newStatus === 'cancelado' || $newStatus === 'rechazado') && ($prevStatus === 'aprobado' || $prevStatus === 'despachado')) {
            $stmtItems = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = :order_id");
            $stmtItems->execute(['order_id' => $orderId]);
            $items = $stmtItems->fetchAll();

            foreach ($items as $it) {
                $stmtStock = $pdo->prepare("UPDATE products SET stock = stock + :qty WHERE id = :pid");
                $stmtStock->execute(['qty' => $it['quantity'], 'pid' => $it['product_id']]);
            }
        }

        $stmt = $pdo->prepare("UPDATE orders SET status = :status WHERE id = :id");
        $stmt->execute(['status' => $newStatus, 'id' => $orderId]);

        echo json_encode(['status' => 'success', 'message' => "Estado actualizado a '{$newStatus}'"]);
        exit;
    }

    echo json_encode(['status' => 'error', 'message' => 'Parámetros inválidos']);
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
