// generate_baires_descriptions.js
const fs = require('fs');

function createDescription(brand, title, animal, ingredients) {
  const t = title.toLowerCase();
  let intro = '';
  let benefits = [];

  // ==========================
  // 1. FAWNA
  // ==========================
  if (brand === 'Fawna') {
    if (animal === 'gato') {
      if (t.includes('urinario')) {
        intro = 'Fórmula super premium especialmente desarrollada para la salud del tracto urinario felino. Combina salmón y pollo de alta digestibilidad con un estricto control de minerales que promueve un pH urinario óptimo y ayuda a prevenir la formación de cálculos de estruvita y oxalato cálcico.';
        benefits = ['Control de pH urinario y salud renal', 'Proteína de salmón y pollo de máxima asimilación', 'Taurina y ácidos grasos Omega 3 y 6 para corazón y pelaje'];
      } else if (t.includes('esterilizado')) {
        intro = 'Alimento super premium diseñado para satisfacer las necesidades metabólicas de gatos castrados o esterilizados. Con niveles calóricos equilibrados, L-carnitina y fibras naturales que ayudan a mantener el peso ideal sin perder masa muscular magra.';
        benefits = ['Control calórico y saciedad prolongada', 'Protección del tracto urinario inferior', 'Prebióticos y probióticos para una flora intestinal saludable'];
      } else if (t.includes('gatito')) {
        intro = 'Nutrición biológicamente avanzada para gatitos en fase de crecimiento activo y hembras gestantes o lactantes. Aporta concentraciones elevadas de proteína animal de salmón y pollo, DHA para el desarrollo cognitivo y antioxidantes naturales para fortalecer el sistema inmunitario.';
        benefits = ['Desarrollo óptimo de cerebro y visión (DHA)', 'Alta densidad de nutrientes y energía para el crecimiento', 'Albúmina de huevo y zapallo para máxima digestibilidad'];
      } else {
        intro = 'Alimento super premium con un perfil nutricional de alta pureza inspirado en la dieta natural de los felinos. Elaborado con harina de salmón, pollo y arroz integral, enriquecido con superalimentos como arándanos, zapallo y zanahoria para vitalidad plena.';
        benefits = ['Salud intestinal y heces firmes con probióticos activos', 'Piel protegida y pelaje brillante con aceite de salmón', 'Taurina esencial para la agudeza visual y función cardíaca'];
      }
    } else {
      // Perro Fawna
      if (t.includes('cachorro') && t.includes('pequeñ')) {
        intro = 'Alimento super premium formulado a medida para cachorros de razas pequeñas hasta los 10-12 meses. Con croqueta adaptada a mandíbulas pequeñas, alta densidad energética y DHA para un óptimo desarrollo cerebral, óseo y muscular.';
        benefits = ['Crecimiento armónico con calcio, fósforo y condroprotectores', 'DHA y Omega 3 proveniente de aceite de salmón', 'Zapallo y prebióticos para una digestión delicada'];
      } else if (t.includes('cachorro')) {
        intro = 'Fórmula super premium para cachorros de razas medianas y grandes durante su etapa de desarrollo más exigente. Proporciona un ratio calcio/fósforo calibrado y protectores articulares (glucosamina y condroitina) para garantizar un desarrollo musculoesquelético armónico.';
        benefits = ['Soporte articular avanzado para razas medianas y grandes', 'Inmunidad reforzada con calostro, vitaminas y antioxidantes', 'Proteínas de salmón y pollo de alto valor biológico'];
      } else if (t.includes('senior')) {
        intro = 'Nutrición super premium diseñada para perros en edad madura o avanzada. Aporte calórico moderado para prevenir el sobrepeso, glucosamina y condroitina para la movilidad articular y antioxidantes naturales que combaten el envejecimiento celular.';
        benefits = ['Cuidado articular y flexibilidad con glucosamina y colágeno', 'Antioxidantes naturales (arándanos, romero, tocoferoles)', 'Fibras digestivas para un tránsito intestinal suave'];
      } else if (t.includes('light')) {
        intro = 'Alimento super premium para perros adultos con tendencia al sobrepeso o actividad física reducida. Contiene un balance óptimo de fibras saciantes y proteínas nobles que promueven la pérdida o mantenimiento de peso sin descuidar la masa muscular.';
        benefits = ['Bajo en calorías y grasas con efecto saciante', 'L-carnitina para la metabolización eficiente de grasas', 'Omega 3 y 6 para preservar la salud de piel y pelo'];
      } else if (t.includes('pequeñ')) {
        intro = 'Alimento super premium diseñado para perros adultos de razas pequeñas. Con croquetas crocantes de tamaño específico que reducen la formación de placa bacteriana y una fórmula hiperdigestible con salmón patagónico y pollo.';
        benefits = ['Alta palatabilidad para paladares exigentes', 'Croqueta de tamaño adecuado que cuida la higiene dental', 'Glucosamina, condroitina y probióticos vivos'];
      } else {
        intro = 'Alimento super premium para perros adultos de razas medianas y grandes. Formulado con salmón y pollo de alta calidad, arroz integral y superfoods que aseguran energía sostenida, músculos fuertes y una salud articular inmejorable.';
        benefits = ['Glucosamina y condroitina para articulaciones resistentes', 'Piel sana y pelaje reluciente con aceite de salmón', 'Extracto de yucca y probióticos para heces firmes y con poco olor'];
      }
    }
  }

  // ==========================
  // 2. OLD PRINCE
  // ==========================
  else if (brand === 'Old Prince') {
    // 2.1 Proteínas Noveles
    if (t.includes('proteínas noveles') || t.includes('proteinas noveles')) {
      if (animal === 'gato') {
        if (t.includes('kitten') || t.includes('gatito')) {
          intro = 'Alimento balanceado hipoalergénico super premium para gatitos y hembras gestantes. Elaborado con proteínas noveles no convencionales y arroz integral, libre de soja y subproductos, protegiendo el sistema digestivo inmaduro y previniendo sensibilidades alimentarias tempranas.';
          benefits = ['Proteína novel hipoalergénica de fácil asimilación', 'DHA para desarrollo neurológico y agudeza visual', 'Libre de gluten de trigo, soja y colorantes'];
        } else if (t.includes('sterilized') || t.includes('esterilizado')) {
          intro = 'Fórmula hipoalergénica con proteínas noveles para gatos adultos castrados o esterilizados. Aporte energético controlado para prevenir el sobrepeso y balance mineral específico para proteger las vías urinarias en felinos con digestión o piel reactiva.';
          benefits = ['Control calórico con saciedad natural para gatos esterilizados', 'pH urinario equilibrado y prevención de urolitiasis', 'Omega 3 y 6 de aceite de pescado para un pelaje suave sin caspa ni prurito'];
        } else {
          intro = 'Alimento hipoalergénico de alta gama para gatos adultos con intolerancias digestivas o afecciones dérmicas. Utiliza proteínas no tradicionales y carbohidratos refinados de bajo índice glucémico para restaurar la barrera cutánea y asegurar una asimilación perfecta.';
          benefits = ['Monoproteico hipoalergénico sin fuentes proteicas alergénicas comunes', 'Taurina y metionina para función cardiovascular y urinaria', 'Prebióticos que optimizan la microbiota y reducen el olor fecal'];
        }
      } else {
        // Perro Proteínas Noveles
        if (t.includes('swine') || t.includes('cerdo')) {
          intro = 'Alimento balanceado hipoalergénico con carne de cerdo seleccionada como única fuente proteica animal novel y arroz integral. Fórmula libre de soja, pollo y subproductos, recomendada especialmente para perros con alergias alimentarias, intolerancias cutáneas o digestión hiperreactiva.';
          benefits = ['Monoproteico con proteína novel de cerdo hipoalergénica', 'Sin soja, trigo ni subproductos para mínima reactividad', 'Garbanzos, lentejas y arvejas que aportan fibras nobles'];
        } else if (t.includes('puppy') || t.includes('cachorro')) {
          intro = 'Fórmula hipoalergénica con cordero seleccionado y arroz integral para cachorros de todas las razas con predisposición a sensibilidades alimentarias. Brinda nutrientes esenciales para el crecimiento armónico sin los alérgenos proteicos más frecuentes.';
          benefits = ['Proteína novel de cordero de alta digestibilidad', 'Libre de soja y maíz para proteger el intestino en desarrollo', 'Aceite de salmón y condroprotectores para huesos y articulaciones'];
        } else if (t.includes('senior')) {
          intro = 'Alimento hipoalergénico para perros adultos mayores formulado con harina de cordero y arroz integral. Ideal para perros senior que sufren picazón cutánea, caspa o molestias digestivas causadas por fuentes proteicas comunes.';
          benefits = ['Digestión hipoalergénica suave para estómagos maduros', 'Soporte articular con condroitina y glucosamina', 'Control de sodio y fósforo para protección renal'];
        } else if (t.includes('light')) {
          intro = 'Fórmula hipoalergénica para control de peso a base de cordero y arroz integral. Permite reducir el tejido adiposo o sostener el peso ideal sin desencadenar alergias alimentarias.';
          benefits = ['Calorías controladas con fibra natural saciante', 'Proteína de cordero hipoalergénica para mantener el tono muscular', 'Ácidos grasos esenciales Omega 3 y 6 para la elasticidad de la piel'];
        } else if (t.includes('small') || t.includes('pequeñ')) {
          intro = 'Alimento hipoalergénico de cordero y arroz integral para perros de razas pequeñas. Tamaño de kibble adaptado para una masticación confortable y alta absorción de nutrientes en estómagos sensibles.';
          benefits = ['Alivia el prurito y la irritación cutánea de origen alimentario', 'Croqueta crujiente para bocas pequeñas', 'Heces compactas y digestión equilibrada'];
        } else {
          intro = 'Alimento hipoalergénico a base de cordero y arroz integral para perros adultos de razas medianas y grandes. Su fórmula con proteínas noveles reduce significativamente las reacciones adversas al alimento, mejorando visiblemente el pelaje y la salud digestiva.';
          benefits = ['Proteína de cordero como fuente no habitual no alergénica', 'Libre de soja y gluten de trigo', 'Piel sana, pelaje denso y articulaciones lubricadas'];
        }
      }
    }
    // 2.2 Equilibrium
    else if (t.includes('equilibrium')) {
      if (animal === 'gato') {
        if (t.includes('urinario')) {
          intro = 'Nutrición especializada para gatos adultos que requieren cuidado urinario diario. Formulado con balance catiónico-aniónico para un pH urinario controlado y prevención activa de urolitiasis.';
          benefits = ['Control de pH urinario y bajo tenor de magnesio', 'Aceite de pescado rico en Omega 3 antiinflamatorio', 'Taurina para la función cardíaca y visual'];
        } else if (t.includes('esterilizado') || t.includes('castrado')) {
          intro = 'Nutrición equilibrada para gatos castrados o esterilizados, con tenor graso controlado, fibras naturales y aporte balanceado de minerales para evitar el sobrepeso y cuidar el tracto urinario.';
          benefits = ['Prevención del sobrepeso post-castración', 'Salud del tracto urinario felino', 'Fórmula anti-bolas de pelo con celulosa purificada'];
        } else if (t.includes('gatito') || t.includes('crecimiento')) {
          intro = 'Alimento balanceado super premium diseñado para gatitos en fase de crecimiento acelerado. Brinda proteínas de máxima asimilación, DHA y minerales equilibrados para un desarrollo integral perfecto.';
          benefits = ['DHA y ácido fólico para el desarrollo cognitivo', 'Inmunidad fortalecida con prebióticos MOS y FOS', 'Croqueta pequeña y crocante fácil de masticar'];
        } else {
          intro = 'Alimento balanceado super premium para gatos adultos de todas las razas. Proteínas nobles de pollo y pescado que garantizan músculos tonificados, vitalidad duradera y salud urinaria permanente.';
          benefits = ['Alta palatabilidad felina con carnes seleccionadas', 'Taurina para corazón y agudeza visual', 'Salud intestinal con prebióticos FOS y extracto de yucca'];
        }
      } else {
        // Perro Equilibrium
        if (t.includes('senior')) {
          intro = 'Fórmula de equilibrio nutricional para perros senior en edad madura. Protege las articulaciones y favorece la digestión con ingredientes de alta asimilación y antioxidantes celulares.';
          benefits = ['Movilidad articular protegida con condroitina y glucosamina', 'Antioxidantes contra el envejecimiento celular', 'Heces consistentes y digestión suave'];
        } else if (t.includes('control de peso') || t.includes('light')) {
          intro = 'Alimento diseñado para la reducción y mantenimiento del peso corporal en perros adultos. Mayor contenido de fibra dietaria insoluble que produce sensación de saciedad y menor densidad calórica.';
          benefits = ['Efecto saciante con fibras vegetales seleccionadas', 'Nivel lipídico moderado con L-carnitina', 'Proteína de pollo de calidad para conservar masa magra'];
        } else if (t.includes('cachorro') && t.includes('pequeñ')) {
          intro = 'Alimento super premium Equilibrium para cachorros de razas pequeñas. Croqueta miniatura fácil de quebrar, con un balance exacto de aminoácidos, calcio y DHA para un inicio de vida saludable.';
          benefits = ['Desarrollo óseo y muscular armónico', 'DHA para estimulación neurológica temprana', 'Prebióticos para una microflora intestinal protegida'];
        } else if (t.includes('cachorro')) {
          intro = 'Alimento balanceado para cachorros de razas medianas y grandes con el sistema Equilibrium. Balance exacto de aminoácidos, minerales y ácidos grasos para un crecimiento osteoarticular seguro.';
          benefits = ['Crecimiento firme y sostenido con ratio Ca:P óptimo', 'Condroprotectores para articulaciones en desarrollo', 'Inmunidad reforzada con nucleótidos y vitaminas'];
        } else if (t.includes('pequeñ')) {
          intro = 'Fórmula Equilibrium a medida para perros adultos de razas pequeñas. Densidad energética adecuada a su metabolismo activo, con croquetas adaptadas que cuidan la dentadura.';
          benefits = ['Energía concentrada para metabolismos rápidos', 'Piel sana y pelaje reluciente con Omega 3 y 6', 'Higiene bucodental y reducción de sarro'];
        } else {
          intro = 'Alimento balanceado completo para perros adultos de razas medianas y grandes con tecnología Equilibrium. Brinda una digestibilidad superior gracias a la combinación de carne de pollo, arroz y aceites esenciales.';
          benefits = ['Músculos fuertes con proteína animal de calidad', 'Pelaje brillante y piel protegida', 'Prebióticos para equilibrio de la microbiota'];
        }
      }
    }
    // 2.3 Old Prince Premium
    else {
      if (animal === 'gato') {
        if (t.includes('urinario')) {
          intro = 'Fórmula especializada de Old Prince Premium para gatos adultos con predisposición a problemas urinarios. Formulado con niveles controlados de minerales para favorecer la disolución de cristales y un tracto urinario saludable.';
          benefits = ['Control de pH y bajo contenido de magnesio', 'Aceites grasos Omega 3 antiinflamatorios', 'Taurina esencial para la función visual y cardíaca'];
        } else if (t.includes('cordero')) {
          intro = 'Alimento premium a base de cordero seleccionado para gatos adultos. Alternativa sabrosa y digestible que cuida el sistema digestivo de los felinos y realza el brillo natural del manto.';
          benefits = ['Carne de cordero como fuente alternativa sabrosa', 'Control de bolas de pelo con fibras naturales', 'Pelaje sedoso y piel sin descamaciones'];
        } else if (t.includes('gatito')) {
          intro = 'Nutrición balanceada premium para gatitos en pleno crecimiento y desarrollo. Aporte energético concentrado con proteínas nobles, leche y taurina que garantizan vitalidad y bienestar.';
          benefits = ['Crecimiento saludable con calcio y fósforo balanceados', 'Taurina y vitaminas para vista y corazón', 'Excelente digestibilidad y palatabilidad felina'];
        } else {
          intro = 'Alimento balanceado premium para gatos adultos de todas las razas. Formulado con ingredientes seleccionados que aportan todos los nutrientes esenciales para una vida larga, activa y saludable.';
          benefits = ['Proteínas seleccionadas para masa muscular óptima', 'Fibras naturales para heces firmes y control de olores', 'Ácidos grasos para pelaje brillante'];
        }
      } else {
        // Perro Old Prince Premium
        if (t.includes('cordero') && t.includes('pequeñ')) {
          intro = 'Alimento premium para perros adultos de razas pequeñas con sabor cordero y arroz. Brinda una excelente tolerancia digestiva con croquetas pequeñas diseñadas para una masticación confortable.';
          benefits = ['Carne de cordero de alta digestibilidad', 'Croqueta de tamaño adaptado para razas pequeñas', 'Piel protegida y manto brillante con ácidos grasos'];
        } else if (t.includes('cordero')) {
          intro = 'Alimento completo de la línea premium a base de cordero y arroz para perros adultos de todas las razas. Una alternativa altamente digerible que favorece la absorción y cuida la salud cutánea.';
          benefits = ['Proteína de cordero para digestión amable', 'Omega 3 y 6 para la salud del manto', 'Balance vitamínico y mineral para energía diaria'];
        } else if (t.includes('cachorro')) {
          intro = 'Nutrición balanceada premium para cachorros con combinación de pollo y carne vacuna seleccionada. Aporta la energía y los aminoácidos requeridos para un desarrollo corporal pleno.';
          benefits = ['Desarrollo óseo y muscular balanceado', 'Proteínas animales de alto valor biológico', 'Prebióticos para una microflora intestinal sana'];
        } else {
          intro = 'Alimento balanceado premium para perros adultos con sabrosa combinación de pollo y carne vacuna. Nutrición completa y equilibrada que cubre todas las necesidades fisiológicas cotidianas.';
          benefits = ['Proteína de pollo y carne para tono muscular magro', 'Omega 3 y 6 para brillo en el pelaje', 'Fibras naturales para una asimilación eficiente'];
        }
      }
    }
  }

  // ==========================
  // 3. KONGO / KONGO GOLD
  // ==========================
  else if (brand === 'Kongo') {
    if (animal === 'gato') {
      if (t.includes('gatito')) {
        intro = 'Alimento balanceado para gatitos en crecimiento con sabor carne y leche. Proporciona los nutrientes fundamentales para el correcto desarrollo musculoesquelético y defensas naturales.';
        benefits = ['Aporte de calcio y leche en polvo para cachorros felinos', 'Taurina y vitaminas esenciales', 'Heces firmes y digestión sencilla'];
      } else if (t.includes('salmón') || t.includes('salmon') || t.includes('atún') || t.includes('atun')) {
        intro = 'Alimento balanceado completo para gatos adultos con irresistible sabor Salmón y Atún. Formulado con aceites de pescado que cuidan el manto y niveles minerales calibrados para la salud urinaria.';
        benefits = ['Sabor a pescados de alta aceptación felina', 'Control de pH urinario diario', 'Omega 3 y 6 para un pelaje reluciente'];
      } else {
        intro = 'Alimento balanceado completo para gatos adultos sabor Carne y Pollo. Ofrece una combinación nutritiva con proteínas seleccionadas, taurina y fibras vegetales para vitalidad permanente.';
        benefits = ['Palatabilidad probada en felinos adultos', 'Taurina para corazón y visión saludable', 'Fibras naturales para una digestión balanceada'];
      }
    } else {
      // Perro Kongo
      if (t.includes('gold')) {
        if (t.includes('cachorro')) {
          intro = 'Alimento súper premium Kongo Gold para cachorros de todas las razas. Formulado con carne vacuna y pollo de primera calidad, sin colorantes artificiales, con nucleótidos y minerales quelados para el crecimiento más fuerte.';
          benefits = ['Sin colorantes ni saborizantes artificiales', 'DHA y ácidos grasos esenciales para el cerebro', 'Condroprotectores y fósforo/calcio equilibrados'];
        } else if (t.includes('pequeñ')) {
          intro = 'Alimento de alta calidad Kongo Gold para perros adultos de razas pequeñas. Croquetas crujientes a medida que previenen el sarro, con extracto de yucca y proteínas hiperdigestibles.';
          benefits = ['Croqueta pequeña crujiente adaptada a su mordida', 'Heces compactas y sin olores molestos', 'Pelaje brillante y sedoso con aceite de pescado'];
        } else {
          intro = 'Alimento completo de la línea Kongo Gold con proteínas seleccionadas de pollo y carne vacuna para perros adultos de razas medianas y grandes. Diseñado para perros activos que requieren energía sostenida, heces secas y compactas, y un pelaje brillante.';
          benefits = ['Ingredientes nobles sin colorantes artificiales', 'Omega 3 y 6 de aceite de pescado', 'Extracto de yucca y pulpa de remolacha para digestión perfecta'];
        }
      } else {
        // Kongo regular
        if (t.includes('cachorro')) {
          intro = 'Nutrición balanceada para cachorros de todas las razas con proteínas de carne y pollo seleccionadas. Aporta los elementos fundamentales para que tu mascota crezca sana, activa y llena de energía.';
          benefits = ['Desarrollo óseo y muscular balanceado', 'Fácil digestión con fibras de trigo y arroz', 'Vitaminas y minerales para defensas fuertes'];
        } else if (t.includes('pequeñ')) {
          intro = 'Alimento balanceado Kongo para perros adultos de razas pequeñas. Fórmula sabrosa con croquetas más pequeñas que facilitan la deglución y el cuidado bucodental.';
          benefits = ['Croqueta pequeña y crocante', 'Excelente relación costo-nutrición', 'Heces consistentes y digestión cuidada'];
        } else {
          intro = 'Alimento completo y balanceado Kongo para perros adultos de razas medianas y grandes. Formulado con carne vacuna y pollo, fibras naturales y minerales que aseguran una condición corporal óptima y vitalidad diaria.';
          benefits = ['Excelente relación costo-nutrición', 'Heces consistentes y digestión cuidada', 'Dientes y huesos fuertes con calcio y fósforo'];
        }
      }
    }
  }

  // ==========================
  // 4. MAINTENANCE CRIADORES
  // ==========================
  else if (brand === 'Maintenance Criadores') {
    if (animal === 'gato') {
      if (t.includes('urinario')) {
        intro = 'Alimento balanceado profesional formulado para el manejo y cuidado del tracto urinario felino. Ayuda a disolver y prevenir cálculos mediante un balance mineral preciso y control riguroso de pH.';
        benefits = ['Control de acidez urinaria', 'Bajo tenor de fósforo y magnesio', 'Proteínas de pescado y pollo altamente digestibles'];
      } else {
        intro = 'Alimento formulado para gatos de criadero y hogares exigentes. Concentración calórica y proteica ideal con taurina para vitalidad, agudeza visual y pelaje lustroso.';
        benefits = ['Taurina para corazón y visión felina', 'Control de bolas de pelo con pulpa de remolacha', 'Heces firmes y menor volumen de deposiciones'];
      }
    } else {
      if (t.includes('cachorro')) {
        intro = 'Fórmula profesional para cachorros y hembras reproductoras en gestación o lactancia. Alta densidad de energía y nutrientes esenciales que aseguran un desarrollo esquelético y muscular superior.';
        benefits = ['Alta densidad energética para máxima vitalidad', 'Proteína animal de carne y pollo para masa muscular', 'Levadura de cerveza rica en vitaminas del complejo B'];
      } else if (t.includes('pequeñ')) {
        intro = 'Nutrición profesional para perros adultos de razas pequeñas. Croqueta de tamaño adecuado y alta palatabilidad con complejo vitamínico y aceites esenciales para criadores.';
        benefits = ['Kibble adaptado a mandíbula pequeña', 'Omega 3 y 6 para un pelaje de exposición', 'Alta asimilación de nutrientes con mínima generación de residuos'];
      } else {
        intro = 'Alimento de alto rendimiento desarrollado para criadores y perros adultos con actividad física moderada a intensa. Aporte proteico y vitamínico equilibrado para un estado corporal óptimo permanente.';
        benefits = ['Excelente condición física y tonicidad muscular', 'Alta digestibilidad que reduce el volumen de las heces', 'Aceites esenciales para piel elástica y manto brillante'];
      }
    }
  }

  // Default fallback if brand not matched
  if (!intro) {
    intro = `Alimento balanceado completo de ${brand} para ${animal === 'gato' ? 'gatos' : 'perros'}, formulado con ingredientes seleccionados para una nutrición óptima y vitalidad diaria.`;
    benefits = ['Proteínas seleccionadas de alto valor biológico', 'Ácidos grasos Omega para piel y pelaje', 'Digestibilidad superior'];
  }

  // Assembly of full description:
  // Paragraph 1: Commercial & Nutritional intro
  // Paragraph 2: Bullet points of benefits
  // Paragraph 3: Complete unabridged ingredients list
  let fullDesc = intro;

  if (benefits.length > 0) {
    fullDesc += '\n\nBeneficios destacados:\n' + benefits.map(b => '• ' + b).join('\n');
  }

  if (ingredients && ingredients.length > 20) {
    fullDesc += '\n\nIngredientes completos:\n' + ingredients;
  }

  return fullDesc;
}

module.exports = { createDescription };
