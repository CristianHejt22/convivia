<?php
// api/smart_bowl.php - Algoritmo Smart Bowl con Tablas de Nutrición Baires S.A., Proporciones y Alimentos Sugeridos
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/database.php';

$animal = strtolower(trim($_GET['animal'] ?? $_GET['pet_type'] ?? $_POST['animal'] ?? $_POST['pet_type'] ?? 'perro')); // perro, gato, ambos
$dogWeight = floatval($_GET['dog_weight'] ?? $_POST['dog_weight'] ?? ($_GET['pet_weight'] ?? 25));
$dogBag = floatval($_GET['dog_bag_weight'] ?? $_POST['dog_bag_weight'] ?? ($_GET['bag_weight'] ?? 15));
$dogStage = strtolower(trim($_GET['dog_stage'] ?? $_POST['dog_stage'] ?? ($_GET['life_stage'] ?? 'adulto')));

$catWeight = floatval($_GET['cat_weight'] ?? $_POST['cat_weight'] ?? 4.0);
$catBag = floatval($_GET['cat_bag_weight'] ?? $_POST['cat_bag_weight'] ?? 7.5);
$catStage = strtolower(trim($_GET['cat_stage'] ?? $_POST['cat_stage'] ?? 'adulto'));
$selectedBrand = trim($_GET['brand'] ?? $_POST['brand'] ?? '');

function calculateBairesDailyGrams($animal, $weight, $stage) {
    if ($animal === 'gato') {
        if ($weight <= 3.5) {
            $wNorm = max(2.0, $weight);
            $grams = 35 + (($wNorm - 2.0) / 1.5) * 20; // 35g a 55g
        } elseif ($weight <= 6.0) {
            $grams = 55 + (($weight - 3.5) / 2.5) * 35; // 55g a 90g
        } else {
            $wNorm = min(10.0, $weight);
            $grams = 90 + (($wNorm - 6.0) / 4.0) * 35; // 90g a 125g
        }

        if ($stage === 'cachorro' || $stage === 'gatito') {
            $grams *= 1.25;
        } elseif ($stage === 'senior') {
            $grams *= 0.90;
        }
    } else {
        if ($weight <= 5.0) {
            $wNorm = max(2.0, $weight);
            $grams = 60 + (($wNorm - 2.0) / 3.0) * 50; // 60g a 110g
        } elseif ($weight <= 10.0) {
            $grams = 110 + (($weight - 5.0) / 5.0) * 65; // 110g a 175g
        } elseif ($weight <= 20.0) {
            $grams = 175 + (($weight - 10.0) / 10.0) * 105; // 175g a 280g
        } elseif ($weight <= 30.0) {
            $grams = 280 + (($weight - 20.0) / 10.0) * 90; // 280g a 370g
        } elseif ($weight <= 40.0) {
            $grams = 370 + (($weight - 30.0) / 10.0) * 80; // 370g a 450g
        } elseif ($weight <= 50.0) {
            $grams = 450 + (($weight - 40.0) / 10.0) * 70; // 450g a 520g
        } else {
            $wNorm = min(75.0, $weight);
            $grams = 520 + (($wNorm - 50.0) / 25.0) * 100; // 520g a 620g
        }

        if ($stage === 'cachorro' || $stage === 'puppy') {
            $grams *= 1.30;
        } elseif ($stage === 'senior') {
            $grams *= 0.88;
        }
    }

    return max(30, round($grams));
}

$monthsEs = ['Jan'=>'Ene','Feb'=>'Feb','Mar'=>'Mar','Apr'=>'Abr','May'=>'May','Jun'=>'Jun','Jul'=>'Jul','Aug'=>'Ago','Sep'=>'Sep','Oct'=>'Oct','Nov'=>'Nov','Dec'=>'Dic'];

function buildSchedule($animal, $weight, $bagKg, $stage) {
    global $monthsEs;
    $dailyGrams = calculateBairesDailyGrams($animal, $weight, $stage);
    $totalGrams = $bagKg * 1000;
    $durationDays = max(5, round($totalGrams / $dailyGrams));
    $durationWeeks = round($durationDays / 7, 1);
    $triggerDay = max(1, $durationDays - 5);

    $servingsPerDay = ($animal === 'perro') ? ($stage === 'cachorro' ? 3 : 2) : ($stage === 'cachorro' ? 3 : 2);
    $gramsPerServing = round($dailyGrams / $servingsPerDay);
    $cupsPerDay = round($dailyGrams / 100, 1); // 1 vaso medidor aprox 100g croquetas

    $today = new DateTime();
    $alertDate = (clone $today)->modify("+$triggerDay days");
    $emptyDate = (clone $today)->modify("+$durationDays days");

    $calendarDays = [];
    $iterDate = clone $today;

    for ($i = 0; $i <= min(60, $durationDays + 4); $i++) {
        $dateStr = $iterDate->format('Y-m-d');
        $dayNum = intval($iterDate->format('d'));
        $dayOfWeek = intval($iterDate->format('w'));
        $status = 'normal';

        if ($i === 0) {
            $status = 'start';
        } elseif ($i === $triggerDay) {
            $status = 'alert';
        } elseif ($i === $durationDays) {
            $status = 'empty';
        } elseif ($i > $durationDays) {
            $status = 'depleted';
        }

        $calendarDays[] = [
            'offset_day' => $i,
            'date' => $dateStr,
            'day_num' => $dayNum,
            'day_of_week' => $dayOfWeek,
            'status' => $status,
            'remaining_grams' => max(0, round($totalGrams - ($i * $dailyGrams)))
        ];

        $iterDate->modify('+1 day');
    }

    $formattedAlertDate = $alertDate->format('d') . ' de ' . ($monthsEs[$alertDate->format('M')] ?? $alertDate->format('M'));
    $formattedEmptyDate = $emptyDate->format('d') . ' de ' . ($monthsEs[$emptyDate->format('M')] ?? $emptyDate->format('M'));

    return [
        'animal' => $animal,
        'weight_kg' => $weight,
        'bag_kg' => $bagKg,
        'stage' => $stage,
        'daily_grams' => $dailyGrams,
        'servings_per_day' => $servingsPerDay,
        'grams_per_serving' => $gramsPerServing,
        'cups_per_day' => $cupsPerDay,
        'duration_days' => $durationDays,
        'duration_weeks' => $durationWeeks,
        'trigger_day' => $triggerDay,
        'alert_date' => $alertDate->format('Y-m-d'),
        'alert_date_formatted' => $formattedAlertDate,
        'empty_date' => $emptyDate->format('Y-m-d'),
        'empty_date_formatted' => $formattedEmptyDate,
        'calendar_days' => $calendarDays
    ];
}

function fetchSuggestedFoods($db, $animal, $weight, $stage, $dailyGrams, $selectedBrand = '') {
    if (!$db) return [];

    $where = ["animal = :animal"];
    $params = [':animal' => $animal];

    if ($selectedBrand && strtolower($selectedBrand) !== 'todas') {
        $where[] = "LOWER(brand) = LOWER(:brand)";
        $params[':brand'] = $selectedBrand;
    }

    if ($animal === 'perro') {
        if ($stage === 'cachorro') {
            $where[] = "(name LIKE '%cachorro%' OR name LIKE '%puppy%')";
        } elseif ($stage === 'senior') {
            $where[] = "(name LIKE '%senior%' OR name LIKE '%mayor%' OR name LIKE '%light%' OR name LIKE '%control de peso%')";
        } else {
            $where[] = "(name NOT LIKE '%cachorro%' AND name NOT LIKE '%puppy%' AND name NOT LIKE '%senior%' AND name NOT LIKE '%light%' AND name NOT LIKE '%control de peso%')";
        }

        $sizeOrder = ($weight <= 10)
            ? "CASE WHEN (name LIKE '%pequeñ%' OR name LIKE '%small%') THEN 0 ELSE 1 END"
            : "CASE WHEN (name LIKE '%median%' OR name LIKE '%grand%' OR name LIKE '%all breed%' OR name LIKE '%todas las razas%') THEN 0 ELSE 1 END";
    } else {
        if ($stage === 'cachorro') {
            $where[] = "(name LIKE '%gatito%' OR name LIKE '%kitten%' OR name LIKE '%cachorro%')";
        } elseif ($stage === 'senior') {
            $where[] = "(name LIKE '%senior%' OR name LIKE '%esterilizado%' OR name LIKE '%sterilized%' OR name LIKE '%urinari%')";
        } else {
            $where[] = "(name NOT LIKE '%gatito%' AND name NOT LIKE '%kitten%')";
        }
        $sizeOrder = "id ASC";
    }

    $sql = "SELECT id, name, brand, animal, life_stage, breed_size, weight_kg, price_list, price_promo, discount_percent, image_url, is_featured
            FROM products 
            WHERE " . implode(' AND ', $where) . "
            ORDER BY 
              $sizeOrder,
              CASE 
                WHEN brand = 'Fawna' THEN 1 
                WHEN brand = 'Old Prince' THEN 2 
                WHEN brand = 'Nutricare' THEN 3 
                WHEN brand = 'Kongo' THEN 4 
                WHEN brand = 'Maintenance Criadores' THEN 5 
                ELSE 6 
              END,
              weight_kg DESC
            LIMIT 12";

    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $suggested = [];
        foreach ($rows as $r) {
            $bagKg = floatval($r['weight_kg']);
            $totalGrams = $bagKg * 1000;
            $durationDays = max(1, round($totalGrams / max(1, $dailyGrams)));
            $durationWeeks = round($durationDays / 7, 1);
            $dailyCostPromo = round(floatval($r['price_promo']) / $durationDays);
            $dailyCostList = round(floatval($r['price_list']) / $durationDays);
            $savings = floatval($r['price_list']) - floatval($r['price_promo']);
            $savingsPercent = (floatval($r['price_list']) > 0) ? round(($savings / floatval($r['price_list'])) * 100) : 0;

            // Brand tier / tagline
            $brandTier = 'Oficial Baires S.A.';
            if ($r['brand'] === 'Fawna') $brandTier = 'Super Premium Patagónico';
            elseif ($r['brand'] === 'Old Prince') $brandTier = 'Proteínas Seleccionadas';
            elseif ($r['brand'] === 'Nutricare') $brandTier = 'Nutrición Completa & Vitalidad';
            elseif ($r['brand'] === 'Kongo') $brandTier = 'Calidad Óptima Baires S.A.';
            elseif ($r['brand'] === 'Maintenance Criadores') $brandTier = 'Línea Criador Balanceada';
            elseif ($r['brand'] === 'Mon Ami') $brandTier = 'Premium Natural Baked';

            $suggested[] = [
                'id' => intval($r['id']),
                'name' => $r['name'],
                'brand' => $r['brand'],
                'brand_tier' => $brandTier,
                'animal' => $r['animal'],
                'life_stage' => $r['life_stage'],
                'weight_kg' => $bagKg,
                'price_promo' => floatval($r['price_promo']),
                'price_list' => floatval($r['price_list']),
                'savings' => $savings,
                'savings_percent' => $savingsPercent,
                'image_url' => $r['image_url'],
                'duration_days' => $durationDays,
                'duration_weeks' => $durationWeeks,
                'daily_cost_promo' => $dailyCostPromo,
                'daily_cost_list' => $dailyCostList
            ];
        }
        return $suggested;
    } catch (Exception $e) {
        return [];
    }
}

$db = null;
try {
    $db = getDBConnection();
} catch (Exception $e) {
    // Ignore DB error, schedule still works
}

$results = [];
$suggestedFoods = [];

if ($animal === 'ambos') {
    $dogSchedule = buildSchedule('perro', $dogWeight, $dogBag, $dogStage);
    $catSchedule = buildSchedule('gato', $catWeight, $catBag, $catStage);
    $results['dog'] = $dogSchedule;
    $results['cat'] = $catSchedule;

    $suggestedFoods['dog'] = fetchSuggestedFoods($db, 'perro', $dogWeight, $dogStage, $dogSchedule['daily_grams'], $selectedBrand);
    $suggestedFoods['cat'] = fetchSuggestedFoods($db, 'gato', $catWeight, $catStage, $catSchedule['daily_grams'], $selectedBrand);
} elseif ($animal === 'gato') {
    $catSchedule = buildSchedule('gato', $catWeight, $catBag, $catStage);
    $results['cat'] = $catSchedule;
    $suggestedFoods['cat'] = fetchSuggestedFoods($db, 'gato', $catWeight, $catStage, $catSchedule['daily_grams'], $selectedBrand);
} else {
    $dogSchedule = buildSchedule('perro', $dogWeight, $dogBag, $dogStage);
    $results['dog'] = $dogSchedule;
    $suggestedFoods['dog'] = fetchSuggestedFoods($db, 'perro', $dogWeight, $dogStage, $dogSchedule['daily_grams'], $selectedBrand);
}

echo json_encode([
    'status' => 'success',
    'source' => 'Tablas Nutricionales Oficiales Baires S.A. (Old Prince, Fawna, Kongo, Maintenance Criadores)',
    'animal_selected' => $animal,
    'schedule' => $results,
    'suggested_foods' => $suggestedFoods
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
