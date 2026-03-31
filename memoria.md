# CONTEXTO DEL PROYECTO

Quiero que construyas un sistema POS (Point of Sale) para restaurante. 
Tengo un sistema existente que quiero clonar funcionalmente
con exactamente la misma UX/UI, pero en una tecnología diferente ya que en ocasiones falla mucho. 

Antes de escribir una sola línea de código, lee toda esta especificación, 
hazme preguntas si algo no queda claro, y luego propón la arquitectura 
completa para mi aprobación.

---

# STACK TECNOLÓGICO OBJETIVO

- Frontend: React + TypeScript + Tailwind CSS
- Backend: Node.js con Express o Fastify
- Base de datos: PostgreSQL
- Tiempo real: WebSockets con Socket.io + Redis
- Despliegue: Docker + Docker Compose + Nginx (VPS)
- Impresión local: Daemon en Node.js que corre en el PC de caja, 
  se conecta por WebSocket al servidor y envía comandos ESC/POS 
  por USB a las impresoras

---

# ARQUITECTURA DE ROLES Y ACCESO

3 roles con permisos distintos:

1. **Administrador**: Acceso total — reportes, configuración, 
   creación de mesas, usuarios, descuentos.
2. **Cajero**: Control de hardware local, cobros, salidas de caja, 
   puede aplicar descuentos y cortesías.
3. **Mesero**: Operación de salón — abrir mesas, agregar productos, 
   enviar comandas. Opera 100% desde móvil.

Autenticación tradicional por usuario y contraseña.
Log de auditoría inmutable: quién anuló producto, borró cuenta, 
aplicó descuento.

---

# MÓDULO 1 — MAPA DE MESAS (Pantalla principal)

Layout de dos columnas: mapa de mesas a la izquierda (70%), 
panel lateral derecho (30%) que cambia según el contexto.

**El mapa:**
- Mesas configurables: cuadradas o circulares, posicionadas 
  drag-and-drop para replicar el layout físico del local
- Múltiples salones con tabs (ej: "Salón 1", "Afuera")
- Buscador "Ir a mesa" en la parte superior del panel derecho

**Estados visuales de cada mesa (en tiempo real vía WebSocket):**
- Libre: color neutro/claro
- Ocupada: fondo ROJO
- Pidiendo cuenta (factura solicitada): fondo AZUL
- Pagando: estado transitorio

**Panel derecho — Mesa LIBRE (al hacer clic):**
- Título: "MESA [número]"
- Campo: Personas (con botones − y +)
- Campo: Mesero (dropdown)
- Campo: Comentario (textarea libre)
- Botón CTA: "Abrir mesa" (color destacado)

**Panel derecho — Mesa ABIERTA:**
- Título: "MESA [número]" con header en rojo
- Info: "X personas, DD/MM/AA HH:MM:SS"
- Sección ADICIONAR:
  - Buscador de producto con botón +
  - Grid de productos frecuentes/recientes (chips clicables)
  - Lista de ítems ya confirmados: cantidad | nombre | precio | ícono X
  - Total acumulado
- Botón inferior: "% Aplicar Descuento"
- Botón inferior derecho: "Cerrar mesa [N]"
- Íconos superiores derecha: imprimir factura | editar mesa 
  (con dropdown: Editar Venta / Mover Productos / Mover Venta)

**Flujo de agregar productos (estado intermedio):**
Cuando el mesero selecciona productos pero aún no confirma, 
aparece una sección expandida debajo de ADICIONAR con:
- Cada ítem: botones − cantidad + | nombre | precio | 
  ícono comentario | ícono X
- "Total a confirmar: $XX.XXX"
- Botón "Cancelar" y botón "Confirmar" (CTA)
- AL CONFIRMAR: los productos pasan a la lista fija, 
  el sistema dispara impresión de comanda a la impresora 
  correspondiente según categoría del producto

**Modal APLICAR DESCUENTO:**
- Campo: Motivo del descuento (texto libre)
- Selector: Tipo → Porcentual (radio) | Fijo (radio)
- Campo: Valor + indicador % o $
- Botones: Cancelar | Confirmar

**Acción IMPRIMIR FACTURA:**
- No abre modal, simplemente cambia el color de la mesa a AZUL
- Presionar nuevamente revierte a ROJO

**Modal CERRAR MESA:**
- Título: "CERRAR MESA [N]"
- Columna izquierda — ADICIONES:
  - Lista de productos consumidos con cantidades y precios
  - Subtotal
  - Descuentos aplicados (línea por descuento con motivo y valor)
  - Total final
  - Ícono de impresora (reimprimir factura)
- Columna derecha — PROPINA:
  - Botón + para agregar propina
  - Método de pago de propina (dropdown: Efectivo, Tarjeta, etc.)
  - Monto de propina
  - Ícono X para eliminar
- Columna derecha — PAGO:
  - Botón + para agregar forma de pago
  - Método de pago (dropdown)
  - Monto pagado
  - Ícono X
  - Múltiples formas de pago simultáneas (dividir cuenta)
- Campo: Vuelto (calculado automáticamente)
- Botones: Cancelar | "Cerrar mesa [N]" (CTA rojo)

---

# MÓDULO 2 — VENTAS Y REPORTES

Navegación superior con tabs: Ventas | Movimientos de caja | 
Arqueos de Caja | Propinas | Descuentos

**Tab Ventas:**
- Botón "Abrir la caja" (visible para cajero/admin)
- Filtros en fila: Hora inicio | Turno | Diario | 24h | 
  mes | año
- Filtros en segunda fila: Estado de venta | Tipo de venta | 
  Cam/Rep | Medio de pago | Mesa | Facturación
- Resumen estadístico: rango de fechas | Ventas (N) | 
  Promedio por venta | Personas | Promedio por persona | Total
- Link "MÁS INFO" expandible
- Tabla de ventas: Hora inicio | Hora cierre | Estado | Mesa | 
  Cam/Rep | Cliente | Facturación | Total
- Al hacer clic en una fila → panel derecho muestra detalle 
  completo: timestamps, tipo, estado, mesa, personas, 
  lista de adiciones con precios, total, y sección PAGOS

**Estructura granular de datos (cada ítem = 1 registro):**
Venta ID | Fecha | Hora | Mesa | Producto | Valor | Usuario

**Exportación:** Botón para descargar histórico en CSV
**Retención:** Datos activos por 1 año

---

# MÓDULO 3 — PRODUCTOS Y CATÁLOGO

Submenú con tabs: Productos | Ingredientes | Grupos modificadores | 
Cat. de Productos | Cat. de Ingredientes | Fichas técnicas

**Sección Productos:**
- Panel izquierdo: lista de categorías (Bebidas Calientes, 
  Bebidas Frías, Cabalgatas, Carnes, Cervezas, Entradas, 
  Licores, etc.) — clic filtra la tabla
- Barra superior: filtro por nombre | botón "Ordenar Productos" | 
  botón "Cargar menú" | botón "+ Nuevo producto" | 
  ícono maximizar
- Tabla: Cód. | Producto | Costo | Margen $ | Margen % | 
  Markup % | Precio | ícono favorito (estrella)
- Productos favoritos marcados con estrella rellena (aparecen 
  en el grid de acceso rápido al tomar pedidos)

**Reglas de negocio:**
- Sin variantes ni control de ingredientes
- Inventario de producto terminado
- Precios incluyen impuestos
- Productos agotados se ocultan manualmente

---

# MÓDULO 4 — CONFIGURACIÓN

Dos tabs superiores: "Configuración general" | "Salas y mesas"

**Menú lateral izquierdo con secciones:**

**Cocinas:**
- Lista de cocinas (Barra, Cabalgatas, Cocina, Contenedor, Tienda)
- Cada cocina vinculada a categorías/productos específicos
- Panel derecho al seleccionar: Nombre | Contenedor asignado
- Botón "+ Nueva Cocina"

**Impresoras:**
- Pantalla de instalación con instrucciones
- Descarga de: Extensión Chrome | Aplicación local 
  (Linux / MacOS / Windows)
- Estado de instalación visible

**Opciones de Impresión:**
- Encabezado y Pie de página (botón Configurar) para facturas
- Botón "Imprimir prueba"
- COMANDAS — configuración de tamaño de letra:
  - Encabezado: Tamaño | Alto | Simple/Doble | Ancho Simple/Doble
  - Cuerpo: Tamaño | Alto | Simple/Doble | Ancho Simple/Doble
  - Pie: Tamaño | Alto | Ancho

**Usuarios:**
- Tabla: Usuario | Rol | Nombre | Último Login
- Panel derecho al seleccionar: todos los campos del usuario
  (usuario, contraseña, nombre, email, teléfono, rol, 
  superusuario, activo, último login)
- Botón "+ Nuevo Usuario"
- Roles disponibles: Integraciones | Encargado | Admin | Mesero

**Roles de usuario:** Configuración de permisos por rol

**Turnos:** Gestión de turnos de trabajo

**Medios de Pago:** Efectivo | Tarjeta | Transferencia 
(configurables)

**Preferencias:** Configuración general del sistema

**Carta QR (Menú Público):**
- Configuración básica: habilitar/deshabilitar, descargar QR, 
  nombre del local, mostrar imágenes de productos
- Logo: tipo de visualización, imagen subible
- Foto de portada: imagen subible
- Contacto: teléfono, WhatsApp, email, dirección, horario
- Redes sociales: Facebook, Instagram (URLs)
- El menú público es solo lectura (sin auto-pedido)
- Bilingüe Español/Inglés
- Tiempo real: cambios en el POS se reflejan inmediatamente

**Impuestos:** Configuración de impuestos (ya incluidos en precio)

**Tipos de Comprobante:** Configuración de facturación

---

# MÓDULO 5 — HARDWARE E IMPRESIÓN

**Agente de Impresión Local (Daemon):**
- Script Node.js instalado en el PC de caja
- Se conecta por WebSocket al servidor en la nube
- Al recibir una orden confirmada, enruta a la impresora USB 
  correcta según la categoría del producto:
  - Categoría Licores/Bebidas → Impresora Barra
  - Categoría Comida → Impresora Cocina
  - Facturas/cierres → Impresora Caja
- Comando de apertura de cajón monedero (pulso eléctrico vía 
  impresora de caja) al cerrar mesa o al presionar 
  "Abrir Caja" en el software
- Formato de impresión: ESC/POS puro

---

# COMPORTAMIENTOS GLOBALES DEL SISTEMA

- Sincronización en tiempo real sin recarga de página 
  (todos los meseros ven el mismo estado simultáneamente)
- Eventos WebSocket: mesa_abierta | mesa_cerrada | 
  producto_agregado | producto_cancelado | factura_solicitada
- Webhooks nativos para conectar con n8n 
  (reportes automatizados, alertas de auditoría)
- Navegación superior fija con: logo | iconos de módulos | 
  reloj en tiempo real | botón INICIAL | nombre del local | 
  usuario logueado | ícono mensajes | ícono ayuda
- Responsive: optimizado para móvil (meseros) y 
  desktop/tablet (caja y admin)

---

# INSTRUCCIONES PARA EL AGENTE

1. Lee esta especificación completa antes de hacer cualquier cosa
2. Hazme todas las preguntas que necesites antes de comenzar
3. Propón la estructura de carpetas y arquitectura completa 
   para mi aprobación
4. Empieza por el backend (modelos de base de datos y API) 
   antes que el frontend
5. Implementa los módulos en este orden:
   a. Autenticación y roles
   b. Mapa de mesas (core del negocio)
   c. Toma de pedidos y comandas
   d. Cierre de mesa y pagos
   e. Reportes y ventas
   f. Configuración y catálogo
   g. Agente de impresión local
6. Antes de pasar al siguiente módulo, genera un Artifact 
   (screenshot o walkthrough) para que yo pueda verificar