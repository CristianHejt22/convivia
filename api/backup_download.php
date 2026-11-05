<?php
// api/backup_download.php - Descarga directa y segura de Respaldo de Base de Datos para CONVIVIA
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/sync.php';

$pdo = getDBConnection();
// Asegurar que todos los espejos estén al día antes de la descarga
syncAllDataMirrors($pdo);

$type = $_GET['type'] ?? 'sqlite';
$date = date('Y-m-d_H-i');

if ($type === 'sql') {
    $sqlPath = __DIR__ . '/../database_petshop.sql';
    if (!file_exists($sqlPath)) {
        http_response_code(404);
        die("Archivo SQL no encontrado.");
    }
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="convivia_backup_' . $date . '.sql"');
    header('Content-Length: ' . filesize($sqlPath));
    readfile($sqlPath);
    exit;
} else {
    $sqlitePath = __DIR__ . '/../data_petshop.sqlite';
    if (!file_exists($sqlitePath)) {
        http_response_code(404);
        die("Base de datos SQLite no encontrada.");
    }
    header('Content-Type: application/x-sqlite3');
    header('Content-Disposition: attachment; filename="convivia_backup_' . $date . '.sqlite"');
    header('Content-Length: ' . filesize($sqlitePath));
    readfile($sqlitePath);
    exit;
}
