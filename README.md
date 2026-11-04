# convivia

> **Comunidad Convivial | Respeto, Amor & Servicio Animal**  
> Plataforma e-commerce especializada en nutrición animal, alimentos balanceados oficiales (Baires S.A., Mon Ami, Nutricare) y asesoramiento nutricional predictivo (Smart Bowl).

---

## 🌟 Características Principales

* **Catálogo Oficial:** 145 fórmulas nutricionales oficiales (Fawna, Old Prince, Mon Ami, Nutricare, Kongo, Maintenance Criadores).
* **Modalidad de Precios Duales:** Selector global entre *Precio Preferencial* (transferencia bancaria/efectivo con descuento directo) y *Tarjeta*.
* **Smart Bowl Predictivo & Calendario de Consumo:** Calculadora nutricional interactiva que estima la ración diaria, costo por día y duración exacta de la bolsa.
* **Packs Funcionales & Combos Nutricionales:** Combos inteligentes combinando alimento principal y snacks funcionales con ahorro preferencial.
* **Carrito & Checkout Ágil:** Integración con confirmación directa por WhatsApp con alias bancario oficial (`CONVIVIA.PETS`).
* **Panel de Administración (Ops Suite):** Gestión en tiempo real de productos, precios preferenciales, stock, avisos de envío y pedidos.
* **Diseño Responsive de Alta Fidelidad:** Paleta marfil/lino oficial (`#F8F6EB`) y cyber-luxe nocturno (`#070a11`), optimizado para móviles (grilla de 2 columnas, barra inferior tipo app y menú drawer).

---

## 🚀 Puesta en Marcha Local

### Requisitos
* PHP 8.0+
* MySQL / MariaDB (o SQLite)
* Servidor local (ej. XAMPP o PHP built-in server)

### Instalación Rápida
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/CristianHejt22/convivia.git
   cd convivia
   ```

2. Base de datos:
   * Importar `database_petshop.sql` en MySQL (`petshop_db`), o el sistema generará automáticamente la base SQLite de respaldo.

3. Iniciar el servidor local:
   * Ejecutar `start_server.bat` o:
   ```bash
   php -S localhost:8000 router.php
   ```

4. Abrir en el navegador:
   * Tienda: [http://localhost:8000/](http://localhost:8000/)
   * Panel Admin: [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## 📄 Licencia & Derechos
© 2026 CONVIVIA. Todos los derechos reservados.
