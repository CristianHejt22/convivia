<?php
// api/brands.php - Lista de Marcas Oficiales y Logos Scrapeados
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/database.php';
$pdo = getDBConnection();

$officialBrands = [
    [
        'name' => 'Fawna',
        'origin' => 'Baires S.A.',
        'segment' => 'Super Premium Holístico',
        'logo' => '/assets/img/brands/fawna.png',
        'logo_remote' => 'https://baires-sa.com.ar/img_marcas/logofawna.png',
        'logo_theme' => 'light', // Fondo blanco para letras negras/oscuras
        'description' => 'Nutrición de vanguardia con alta concentración de proteínas de salmón y pollo.'
    ],
    [
        'name' => 'Old Prince',
        'origin' => 'Baires S.A.',
        'segment' => 'Super Premium Proteínas Noveles',
        'logo' => '/assets/img/brands/old_prince.png',
        'logo_remote' => 'https://baires-sa.com.ar/img_marcas/Baires_logo_OldPrince.png',
        'logo_theme' => 'light', // Fondo blanco para letras negras/oscuras
        'description' => 'Proteínas noveles (cordero, cerdo, salmón) ideales para digestión y piel sensible.'
    ],
    [
        'name' => 'Kongo',
        'origin' => 'Baires S.A.',
        'segment' => 'Premium Balanceado',
        'logo' => '/assets/img/brands/kongo.png',
        'logo_remote' => 'https://baires-sa.com.ar/img_marcas/12201901_LogoKongo.png',
        'logo_theme' => 'light', // Fondo blanco para letras negras/rojas
        'description' => 'Nutrición completa y equilibrada para perros y gatos de todas las edades.'
    ],
    [
        'name' => 'Maintenance Criadores',
        'origin' => 'Baires S.A.',
        'segment' => 'Alta Performance Criadores',
        'logo' => '/assets/img/brands/maintenance.png',
        'logo_remote' => 'https://baires-sa.com.ar/img_marcas/12201904_LogoMaintenance.png',
        'logo_theme' => 'light', // Fondo blanco para letras oscuras
        'description' => 'Fórmula para criadores y perros de alta exigencia física y vitalidad.'
    ],
    [
        'name' => 'Mon Ami',
        'origin' => 'Nacional Human Grade',
        'segment' => 'Human Grade & Snacks',
        'logo' => '/assets/img/brands/mon_ami.webp',
        'logo_remote' => 'https://acdn-us.mitiendanube.com/stores/006/071/448/themes/common/logo-1217919693-1744323462-6f3010d659184644b7923c6eb74735911744323462-320-0.webp',
        'logo_theme' => 'light', // Fondo blanco para letras negras
        'description' => 'Nutrición 100% natural con carne fresca argentina, superfoods y snacks funcionales sin conservantes.'
    ],
    [
        'name' => 'Nutricare',
        'origin' => 'Vitalpet S.A.',
        'segment' => 'Super Premium Probiótico',
        'logo' => '/assets/img/brands/nutricare.svg',
        'logo_remote' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/logo.svg',
        'logo_theme' => 'dark', // Fondo negro para letras blancas
        'description' => 'Alimento super premium nacional con probióticos activos, sin colorantes y con antioxidantes naturales para perros y gatos.'
    ]
];

// Contar productos disponibles por marca en la base de datos
foreach ($officialBrands as &$b) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM products WHERE brand = :b");
    $stmt->execute(['b' => $b['name']]);
    $b['product_count'] = intval($stmt->fetchColumn());
}

echo json_encode([
    'status' => 'success',
    'brands' => $officialBrands
]);
