<?php
// api/deploy_sync.php - Endpoint para Sincronizar Espejos y Publicar en Vercel vía Git Push
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/sync.php';

$pdo = getDBConnection();

// 1. Sincronizar todos los espejos locales primero
$syncRes = syncAllDataMirrors($pdo);

// 2. Si estamos en un entorno serverless de sólo lectura (Vercel), no podemos ejecutar git local
$isServerless = (bool)(getenv('VERCEL') || getenv('AWS_LAMBDA_FUNCTION_NAME'));
if ($isServerless) {
    echo json_encode([
        'status' => 'warning',
        'is_serverless' => true,
        'message' => 'Estás ejecutando el panel directamente en Vercel Serverless. Para persistir cambios a largo plazo, editalos desde tu entorno local y hacé clic en Publicar, o conectá una base de datos MySQL en la nube.'
    ]);
    exit;
}

// 3. Ejecutar sincronización con Git
$repoDir = realpath(__DIR__ . '/..');
chdir($repoDir);

$output = [];
$returnVar = 0;

// Verificar estado de cambios
exec("git status --porcelain 2>&1", $output, $returnVar);
$statusOutput = implode("\n", $output);

if (empty(trim($statusOutput))) {
    echo json_encode([
        'status' => 'success',
        'already_synced' => true,
        'message' => 'Todos los datos y precios ya están 100% sincronizados con la web y Vercel.',
        'sync_details' => $syncRes
    ]);
    exit;
}

// Agregar archivos clave de catálogo y base de datos
$cmdAdd = 'git add data_petshop.sqlite assets/data/products.json assets/data/settings.json database_petshop.sql 2>&1';
exec($cmdAdd, $output, $returnVar);

$commitMsg = 'admin: actualizacion automatica de precios y catalogo (' . date('d/m/Y H:i') . ')';
$cmdCommit = 'git commit -m "' . addslashes($commitMsg) . '" 2>&1';
$output = [];
exec($cmdCommit, $output, $returnVar);

$outputPush = [];
$pushReturn = 0;
exec('git push origin main 2>&1', $outputPush, $pushReturn);

if ($pushReturn === 0) {
    echo json_encode([
        'status' => 'success',
        'pushed' => true,
        'message' => '🚀 ¡Catálogo y precios sincronizados y publicados exitosamente! Vercel se está actualizando automáticamente (~25 segundos).',
        'commit' => $commitMsg,
        'sync_details' => $syncRes
    ]);
} else {
    echo json_encode([
        'status' => 'partial_success',
        'pushed' => false,
        'message' => 'Precios guardados y sincronizados localmente en SQLite y JSON. Hubo una advertencia al hacer git push: ' . implode("\n", $outputPush),
        'sync_details' => $syncRes
    ]);
}
exit;
