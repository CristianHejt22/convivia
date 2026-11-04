<?php
// insert_nutricare.php - Inserción completa de productos Nutricare por peso individual
require_once __DIR__ . '/config/database.php';

$pdo = getDBConnection();

$descAdultosMG = <<<EOD
Alimento balanceado super premium para perros adultos de razas medianas y grandes con croqueta de tamaño adaptado ("Mordida Grande"). Formulado con probióticos activos, sin colorantes artificiales y con antioxidantes naturales de origen botánico para una digestión superior, heces firmes y máxima vitalidad.

Beneficios destacados:
• Probióticos activos: Con levaduras seleccionadas (Saccharomyces cerevisiae, Enterococcus faecium y Lactobacillus acidophilus) que modulan la flora intestinal benéfica y refuerzan las defensas naturales.
• Sin colorantes con antioxidantes naturales: Elaborado exclusivamente con el color noble de sus ingredientes y preservado naturalmente con tocoferoles mixtos, extracto de romero y aceites esenciales.
• Salud intestinal y digestibilidad superior: Materias primas de alto valor biológico que optimizan la asimilación de nutrientes, complementadas con extracto de Yucca schidigera y zeolita para reducir olores fecales.
• Piel saludable y manto brillante: Concentración balanceada de ácidos grasos esenciales Omega 3 y Omega 6 procedentes de aceite de pescado puro y aceites vegetales.
• Palatabilidad insuperable: Fórmula irresistible elaborada para satisfacer el apetito de los caninos más exigentes.

Composición centesimal:
• Proteína bruta (mín.): 24%
• Extracto etéreo (mín.): 14%
• Fibra cruda (máx.): 4%
• Minerales totales (máx.): 8%
• Calcio: 0,95% (mín.) - 2,00% (máx.)
• Fósforo: 0,75% (mín.) - 1,50% (máx.)
• Humedad (máx.): 10%
• Energía Metabolizable: 3.800 Kcal/kg de materia seca

Guía de suministro diario sugerido:
• Perros Miniatura (hasta 5 kg): 50 - 120 g / día
• Perros Pequeños (5 a 10 kg): 120 - 200 g / día
• Perros Medianos (10 a 25 kg): 200 - 400 g / día
• Perros Grandes (25 a 45 kg): 400 - 620 g / día
*Una taza de té contiene aproximadamente 80 g de alimento.

Ingredientes completos:
Arroz; maíz; trigo; gluten de maíz; harina de subproductos de pollo; expeller de soja; harina de carne y hueso bovina; pellet de afrechillo de trigo; poroto de soja; sorgo; grasa animal (bovina y/o aviar); aceite vegetal (girasol y/o soja); aceite de pescado (fuente de Omega 3); saborizante: hidrolizado de menudencias vacunas, porcinas y aviares; lino; levadura de cerveza; sal; zeolita; carbonato de calcio; sorbato de potasio; cloruro de potasio; pulpa de remolacha (fuente de fructo-oligosacáridos); manano-oligosacáridos; extracto de Yucca shidigera; metionina; BHT; BHA; extracto de romero; tocoferoles naturales (alfa-beta-gama-delta), aceites esenciales (Orégano-Romero-Tomillo); levaduras Saccharomyces cerevisiae, Enterococcus faecium y Lactobacillus acidophilus; minerales: hierro (como sulfato ferroso), manganeso (como óxido de manganeso), cobre (como sulfato de cobre), zinc (como sulfato de zinc), yodo (como yodato de calcio), selenio (como selenito de sodio); vitaminas: A, D3, E, K, B1, B2, B6, B12, ácido fólico, ácido pantoténico, niacina, biotina, colina.
EOD;

$descAdultosMP = <<<EOD
Alimento balanceado super premium para perros adultos de razas pequeñas con croqueta de tamaño reducido y fácil masticación ("Mordida Pequeña"). Especialmente formulado para satisfacer el metabolismo acelerado de perros pequeños, enriquecido con probióticos activos, antioxidantes naturales y sin colorantes artificiales.

Beneficios destacados:
• Croqueta pequeña adaptada: Textura y tamaño ideal para mandíbulas reducidas que favorece la masticación y previene la formación de placa bacteriana.
• Probióticos activos: Con Saccharomyces cerevisiae, Enterococcus faecium y Lactobacillus acidophilus para proteger la barrera intestinal y optimizar la digestión de estómagos pequeños y sensibles.
• Sin colorantes con antioxidantes naturales: Libre de colorantes artificiales, conservado naturalmente con tocoferoles y extracto de romero.
• Salud de piel y pelaje: Ácidos grasos Omega 3 y 6 provenientes de aceite de pescado para un pelaje radiante y piel sana.
• Alta concentración nutricional y sabor exquisito: Provee la densidad energética necesaria con un sabor irresistible.

Composición centesimal:
• Proteína bruta (mín.): 24%
• Extracto etéreo (mín.): 14%
• Fibra cruda (máx.): 4%
• Minerales totales (máx.): 8%
• Calcio: 0,95% (mín.) - 2,00% (máx.)
• Fósforo: 0,75% (mín.) - 1,50% (máx.)
• Humedad (máx.): 10%
• Energía Metabolizable: 3.800 Kcal/kg de materia seca

Guía de suministro diario sugerido:
• Perros Miniatura (hasta 5 kg): 50 - 120 g / día
• Perros Pequeños (5 a 10 kg): 120 - 200 g / día
• Perros Medianos (10 a 15 kg): 200 - 280 g / día
*Una taza de té contiene aproximadamente 80 g de alimento.

Ingredientes completos:
Arroz; maíz; trigo; gluten de maíz; harina de subproductos de pollo; expeller de soja; harina de carne y hueso bovina; pellet de afrechillo de trigo; poroto de soja; sorgo; grasa animal (bovina y/o aviar); aceite vegetal (girasol y/o soja); aceite de pescado (fuente de Omega 3); saborizante: hidrolizado de menudencias vacunas, porcinas y aviares; lino; levadura de cerveza; sal; zeolita; carbonato de calcio; sorbato de potasio; cloruro de potasio; pulpa de remolacha (fuente de fructo-oligosacáridos); manano-oligosacáridos; extracto de Yucca shidigera; metionina; BHT; BHA; extracto de romero; tocoferoles naturales (alfa-beta-gama-delta), aceites esenciales (Orégano-Romero-Tomillo); levaduras Saccharomyces cerevisiae, Enterococcus faecium y Lactobacillus acidophilus; minerales: hierro (como sulfato ferroso), manganeso (como óxido de manganeso), cobre (como sulfato de cobre), zinc (como sulfato de zinc), yodo (como yodato de calcio), selenio (como selenito de sodio); vitaminas: A, D3, E, K, B1, B2, B6, B12, ácido fólico, ácido pantoténico, niacina, biotina, colina.
EOD;

$descCachorros = <<<EOD
Alimento balanceado super premium para cachorros de todas las razas desde el destete hasta la adultez. Fórmula completa con 27% de proteína de alto valor biológico, enriquecida con probióticos activos, vitaminas y minerales esenciales para un crecimiento armónico, fuerte desarrollo óseo, muscular y cognitivo.

Beneficios destacados:
• Crecimiento armónico y vigoroso: Aporte óptimo de calcio (1,1% - 2%), fósforo y minerales quelados para el desarrollo de huesos fuertes y articulaciones sanas.
• Probióticos activos y sistema inmunológico: Triple cepa probiótica y manano-oligosacáridos (MOS) para poblar el intestino con bacterias benéficas y fortalecer las defensas inmunes del cachorro.
• Sin colorantes con antioxidantes naturales: Libre de colorantes químicos, formulado con antioxidantes botánicos naturales que protegen las células en pleno crecimiento.
• Piel sana y pelo radiante: Aceite de pescado con Omega 3 y 6 para un pelaje sedoso y desarrollo neurológico temprano.
• Alta palatabilidad y digestibilidad: Croqueta crujiente y apetitosa para asegurar una excelente ingesta desde el destete.

Composición centesimal:
• Proteína bruta (mín.): 27%
• Extracto etéreo (mín.): 16%
• Fibra cruda (máx.): 4%
• Minerales totales (máx.): 8%
• Calcio: 1,10% (mín.) - 2,00% (máx.)
• Fósforo: 0,90% (mín.) - 1,50% (máx.)
• Humedad (máx.): 10%
• Energía Metabolizable: 3.900 Kcal/kg de materia seca

Guía de suministro diario sugerido:
• Cachorros 1 a 5 kg: 60 - 200 g (1 ½ a 4 meses) | 40 - 130 g (4 a 12 meses)
• Cachorros 5 a 10 kg: 200 - 330 g (1 ½ a 4 meses) | 130 - 220 g (4 a 12 meses)
• Cachorros 10 a 15 kg: 330 - 450 g (1 ½ a 4 meses) | 220 - 300 g (4 a 12 meses)
• Cachorros 15 a 20 kg: 450 - 560 g (1 ½ a 4 meses) | 300 - 370 g (4 a 12 meses)
• Cachorros 20 a 25 kg: 560 - 660 g (1 ½ a 4 meses) | 370 - 440 g (4 a 12 meses)
• Cachorros 25 a 30 kg: 440 - 510 g (4 a 15 meses razas grandes y gigantes)
*Una taza de té contiene aproximadamente 80 g de alimento.

Ingredientes completos:
Arroz; maíz; trigo; gluten de maíz; harina de subproductos de pollo; poroto de soja; harina de carne y hueso bovina; pellet de afrechillo de trigo; poroto de soja; sorgo; grasa animal (bovina y/o aviar); aceite vegetal (girasol y/o soja); aceite de pescado (fuente de Omega 3); saborizante: hidrolizado de menudencias vacunas, porcinas y aviares; lino; levadura de cerveza; sal; zeolita; carbonato de calcio; sorbato de potasio; cloruro de potasio; pulpa de remolacha (fuente de fructo-oligosacáridos); manano-oligosacáridos; extracto de Yucca shidigera; metionina; BHT; BHA; extracto de romero; tocoferoles naturales (alfa-beta-gama-delta), aceites esenciales (Orégano-Romero-Tomillo); levaduras Saccharomyces cerevisiae, Enterococcus faecium y Lactobacillus acidophilus; minerales: hierro (como sulfato ferroso), manganeso (como óxido de manganeso), cobre (como sulfato de cobre), zinc (como sulfato de zinc), yodo (como yodato de calcio), selenio (como selenito de sodio); vitaminas: A, D3, E, K, B1, B2, B6, B12, ácido fólico, ácido pantoténico, niacina, biotina, colina.
EOD;

$descGatos = <<<EOD
Alimento balanceado super premium para gatos adultos (enteros y castrados). Con 32% de proteína de alta calidad, taurina esencial, control de bolas de pelo mediante fibras especiales y magnesio controlado para cuidar la salud de las vías urinarias inferiores.

Beneficios destacados:
• Control de bolas de pelo (Hairball Control): Fibras vegetales insolubles y pulpa de remolacha que facilitan la eliminación natural de pelos a través del tracto digestivo.
• Aporte de Taurina esencial: Aminoácido vital para el buen funcionamiento del músculo cardíaco, la agudeza visual y la salud reproductiva felina.
• Salud del tracto urinario inferior: Magnesio rigurosamente controlado (máx. 0,1%) y bisulfato ácido de sodio para promover un pH urinario óptimo y prevenir cálculos.
• Probióticos activos: Saccharomyces cerevisiae, Enterococcus faecium y Lactobacillus acidophilus que estabilizan la flora intestinal y optimizan la asimilación.
• Reducción de olores fecales: Extracto de Yucca schidigera y zeolita purificada que disminuyen drásticamente el olor de la bandeja sanitaria.
• Piel sana y pelo brillante: Ácidos grasos Omega 3 y 6 procedentes de aceite de pescado y vegetales para un pelaje suave y tupido.

Composición centesimal:
• Proteína bruta (mín.): 32%
• Extracto etéreo (mín.): 17%
• Fibra cruda (máx.): 4%
• Minerales totales (máx.): 8%
• Magnesio (máx.): 0,1%
• Calcio: 1,20% (mín.) - 2,00% (máx.)
• Fósforo: 1,00% (mín.) - 1,50% (máx.)
• Humedad (máx.): 10%
• Energía Metabolizable: 3.950 Kcal/kg de materia seca

Guía de suministro diario sugerido:
• Gatos 2 a 3 kg: 40 - 50 g (Castrados) | 50 - 75 g (Enteros)
• Gatos 3 a 5 kg: 50 - 70 g (Castrados) | 70 - 100 g (Enteros)
• Gatos 5 a 7 kg: 70 - 100 g (Castrados) | 100 - 130 g (Enteros)
• Hembras gestantes (último tercio): 110 - 145 g / día
• Hembras lactantes: 125 - 375 g / día según tamaño de camada
*Una taza de té contiene aproximadamente 80 g de alimento.

Ingredientes completos:
Arroz; maíz; trigo; gluten de maíz; poroto de soja; pellet de afrechillo de trigo; harina de subproductos de pollo; expeller de soja; harina de pescado; harina de carne y hueso (bovina); grasa animal (bovina y/o aviar); hidrolizado de menudencias de aves, porcinas y vacunas; aceite de pescado (fuente de Omega 3). aceite vegetal (soja y/o girasol); levadura de cerveza; sal; pulpa de remolacha (fuente de fructo-oligosacáridos); bisulfato ácido de sodio; zeolita; fibra cruda insoluble; carbonato de calcio; cloruro de potasio; metionina; sorbato de potasio; propionato de calcio; manano-oligosacáridos; extracto de Yucca shidigera; taurina; BHT; BHA; extracto de romero; tocoferoles naturales; aceites esenciales (orégano–romero-tomillo); arginina; levadura (Sacharomyces cerevisiae), Enterococcus faecium, Lactobacillus acidophilus; minerales: zinc (como óxido y/o sulfato de zinc), hierro (como sulfato ferroso), cobre (como sulfato de cobre), manganeso (como óxido y/o sulfato de manganeso), yodo (como yodato de calcio), selenio (como selenito de sodio); vitaminas: A, D3, E, K, B1, B2, B6, B12, niacina; ácido fólico, ácido pantoténico; biotina, colina.
EOD;

$nutricareProducts = [
    // 1. Adultos Mordida Grande - 20 kg
    [
        'name' => 'Nutricare Perros Adultos Razas Medianas y Grandes (Mordida Grande) 20 kg',
        'slug' => 'nutricare-perros-adultos-mordida-grande-20kg',
        'brand' => 'Nutricare',
        'animal' => 'perro',
        'life_stage' => 'adulto',
        'breed_size' => 'grande',
        'category' => 'super_premium',
        'weight_kg' => 20.00,
        'price_list' => 54900.00,
        'price_promo' => 46665.00,
        'discount_percent' => null,
        'stock' => 15,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/adulto-2-1.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/perroadulto.png',
        'description' => $descAdultosMG,
        'is_featured' => 1
    ],
    // 2. Adultos Mordida Grande - 7.5 kg
    [
        'name' => 'Nutricare Perros Adultos Razas Medianas y Grandes (Mordida Grande) 7.5 kg',
        'slug' => 'nutricare-perros-adultos-mordida-grande-7-5kg',
        'brand' => 'Nutricare',
        'animal' => 'perro',
        'life_stage' => 'adulto',
        'breed_size' => 'grande',
        'category' => 'super_premium',
        'weight_kg' => 7.50,
        'price_list' => 27900.00,
        'price_promo' => 23715.00,
        'discount_percent' => null,
        'stock' => 20,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/adulto-2-1.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/perroadulto.png',
        'description' => $descAdultosMG,
        'is_featured' => 0
    ],
    // 3. Adultos Mordida Grande - 3 kg
    [
        'name' => 'Nutricare Perros Adultos Razas Medianas y Grandes (Mordida Grande) 3 kg',
        'slug' => 'nutricare-perros-adultos-mordida-grande-3kg',
        'brand' => 'Nutricare',
        'animal' => 'perro',
        'life_stage' => 'adulto',
        'breed_size' => 'grande',
        'category' => 'super_premium',
        'weight_kg' => 3.00,
        'price_list' => 15400.00,
        'price_promo' => 13090.00,
        'discount_percent' => null,
        'stock' => 25,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/adulto-2-1.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/perroadulto.png',
        'description' => $descAdultosMG,
        'is_featured' => 0
    ],
    // 4. Adultos Mordida Pequeña - 7.5 kg
    [
        'name' => 'Nutricare Perros Adultos Razas Pequeñas (Mordida Pequeña) 7.5 kg',
        'slug' => 'nutricare-perros-adultos-mordida-pequena-7-5kg',
        'brand' => 'Nutricare',
        'animal' => 'perro',
        'life_stage' => 'adulto',
        'breed_size' => 'pequeña',
        'category' => 'super_premium',
        'weight_kg' => 7.50,
        'price_list' => 27900.00,
        'price_promo' => 23715.00,
        'discount_percent' => null,
        'stock' => 18,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/adulto-2-1.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/perroadulto.png',
        'description' => $descAdultosMP,
        'is_featured' => 1
    ],
    // 5. Adultos Mordida Pequeña - 3 kg
    [
        'name' => 'Nutricare Perros Adultos Razas Pequeñas (Mordida Pequeña) 3 kg',
        'slug' => 'nutricare-perros-adultos-mordida-pequena-3kg',
        'brand' => 'Nutricare',
        'animal' => 'perro',
        'life_stage' => 'adulto',
        'breed_size' => 'pequeña',
        'category' => 'super_premium',
        'weight_kg' => 3.00,
        'price_list' => 15400.00,
        'price_promo' => 13090.00,
        'discount_percent' => null,
        'stock' => 25,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/adulto-2-1.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/perroadulto.png',
        'description' => $descAdultosMP,
        'is_featured' => 0
    ],
    // 6. Cachorro Todas las Razas - 15 kg
    [
        'name' => 'Nutricare Cachorros Todas las Razas 15 kg',
        'slug' => 'nutricare-cachorros-todas-las-razas-15kg',
        'brand' => 'Nutricare',
        'animal' => 'perro',
        'life_stage' => 'cachorro',
        'breed_size' => 'todas',
        'category' => 'super_premium',
        'weight_kg' => 15.00,
        'price_list' => 49800.00,
        'price_promo' => 42330.00,
        'discount_percent' => null,
        'stock' => 15,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/cachorropack-2.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/cachorros-e1690928262595.png',
        'description' => $descCachorros,
        'is_featured' => 1
    ],
    // 7. Cachorro Todas las Razas - 3 kg
    [
        'name' => 'Nutricare Cachorros Todas las Razas 3 kg',
        'slug' => 'nutricare-cachorros-todas-las-razas-3kg',
        'brand' => 'Nutricare',
        'animal' => 'perro',
        'life_stage' => 'cachorro',
        'breed_size' => 'todas',
        'category' => 'super_premium',
        'weight_kg' => 3.00,
        'price_list' => 15900.00,
        'price_promo' => 13515.00,
        'discount_percent' => null,
        'stock' => 20,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/cachorropack-2.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/cachorros-e1690928262595.png',
        'description' => $descCachorros,
        'is_featured' => 0
    ],
    // 8. Gatos Adultos - 7.5 kg
    [
        'name' => 'Nutricare Gatos Adultos 7.5 kg',
        'slug' => 'nutricare-gatos-adultos-7-5kg',
        'brand' => 'Nutricare',
        'animal' => 'gato',
        'life_stage' => 'adulto',
        'breed_size' => 'todas',
        'category' => 'super_premium',
        'weight_kg' => 7.50,
        'price_list' => 35800.00,
        'price_promo' => 30430.00,
        'discount_percent' => null,
        'stock' => 15,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/bolsagato-2.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/gato.png',
        'description' => $descGatos,
        'is_featured' => 1
    ],
    // 9. Gatos Adultos - 3 kg
    [
        'name' => 'Nutricare Gatos Adultos 3 kg',
        'slug' => 'nutricare-gatos-adultos-3kg',
        'brand' => 'Nutricare',
        'animal' => 'gato',
        'life_stage' => 'adulto',
        'breed_size' => 'todas',
        'category' => 'super_premium',
        'weight_kg' => 3.00,
        'price_list' => 18400.00,
        'price_promo' => 15640.00,
        'discount_percent' => null,
        'stock' => 25,
        'image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/09/bolsagato-2.png',
        'secondary_image_url' => 'https://nutricarepets.com.ar/wp-content/uploads/2023/08/gato.png',
        'description' => $descGatos,
        'is_featured' => 0
    ]
];

// Limpiar registros previos de Nutricare si existieran
$pdo->exec("DELETE FROM products WHERE brand = 'Nutricare'");

$stmt = $pdo->prepare("INSERT INTO products 
    (name, slug, brand, animal, life_stage, breed_size, category, weight_kg, price_list, price_promo, discount_percent, stock, image_url, secondary_image_url, description, is_featured) 
    VALUES 
    (:name, :slug, :brand, :animal, :life_stage, :breed_size, :category, :weight_kg, :price_list, :price_promo, :discount_percent, :stock, :image_url, :secondary_image_url, :description, :is_featured)");

$inserted = 0;
foreach ($nutricareProducts as $p) {
    $stmt->execute($p);
    $inserted++;
    echo "✓ Insertado: [ID {$pdo->lastInsertId()}] {$p['name']} ({$p['weight_kg']} kg) - \${$p['price_list']}\n";
}

echo "\nTotal de productos Nutricare insertados con éxito: $inserted\n";
