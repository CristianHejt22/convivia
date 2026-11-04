<?php
require_once __DIR__ . '/config/database.php';
$pdo = getDBConnection();
$driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
echo "Driver: " . $driver . PHP_EOL;
if ($driver === 'mysql') {
    $cols = $pdo->query('DESCRIBE products')->fetchAll(PDO::FETCH_COLUMN);
    echo "Columns: " . implode(', ', $cols) . PHP_EOL;
} else {
    $cols = $pdo->query('PRAGMA table_info(products)')->fetchAll(PDO::FETCH_ASSOC);
    echo "Columns: " . implode(', ', array_column($cols, 'name')) . PHP_EOL;
}
?>