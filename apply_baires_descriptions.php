<?php
// apply_baires_descriptions.php
require_once __DIR__ . '/config/database.php';

$pdo = getDBConnection();
$updatesFile = __DIR__ . '/baires_updates.json';

if (!file_exists($updatesFile)) {
    die("File baires_updates.json does not exist.\n");
}

$updates = json_decode(file_get_contents($updatesFile), true);
if (!$updates || !is_array($updates)) {
    die("Invalid JSON in baires_updates.json.\n");
}

echo "Applying " . count($updates) . " updates to database...\n";

$stmt = $pdo->prepare("UPDATE products SET description = :description WHERE id = :id");

$successCount = 0;
foreach ($updates as $u) {
    $stmt->execute([
        ':description' => $u['description'],
        ':id' => $u['id']
    ]);
    if ($stmt->rowCount() > 0) {
        $successCount++;
        echo "Updated [#{$u['id']}] {$u['name']} (Brand: {$u['brand']}, Len: " . strlen($u['description']) . ")\n";
    } else {
        // Might be unchanged if identical
        echo "Unchanged [#{$u['id']}] {$u['name']}\n";
    }
}

echo "\nFinished! Updated: {$successCount} / " . count($updates) . " products.\n";
