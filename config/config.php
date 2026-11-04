<?php
// config/config.php - Configuración General del E-Commerce PetShop 3.0

define('APP_NAME', 'CONVIVIA - Comunidad Convivial');
define('APP_URL', 'http://localhost:8000');
define('UPLOAD_DIR', __DIR__ . '/../uploads/comprobantes/');

// Datos de cobro para Transferencia Bancaria
define('BANK_NAME', 'Banco Galicia / Mercado Pago');
define('BANK_HOLDER', 'PETSHOP PRO SRL');
define('BANK_CUIT', '30-71648291-4');
define('BANK_ALIAS', 'CONVIVIA.PETS');
define('BANK_CBU', '0070123130004018293812');
define('DISCOUNT_TRANSFER_PERCENT', 15); // 15% de ahorro en efectivo / transferencia

// Configuración de Telegram Bot
// Si dejas el token vacío o de prueba, el sistema almacena las notificaciones en el log y el simulador
define('TELEGRAM_BOT_TOKEN', ''); // Colocar token ej: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'
define('TELEGRAM_CHAT_ID', '');   // Colocar ID de chat o grupo ej: '-100123456789'
define('TELEGRAM_ENABLED', false); // true para enviar a Telegram API real

// Asegurar directorio de subida de forma segura
if (!file_exists(UPLOAD_DIR)) {
    @mkdir(UPLOAD_DIR, 0777, true);
}
