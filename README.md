<div align="center">

# CommerceHub MCP

### Plataforma de E-commerce con IA | AI-Powered E-commerce Platform

**Conecta agentes de IA con tus tiendas online. Gestiona productos, ordenes, inventario, clientes y analytics desde una sola interfaz conversacional.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.12-7C3AED?style=for-the-badge)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[![Claude](https://img.shields.io/badge/Claude-Compatible-f97316?style=flat-square)](https://claude.ai)
[![ChatGPT](https://img.shields.io/badge/ChatGPT-Compatible-10a37f?style=flat-square)](https://openai.com)
[![Gemini](https://img.shields.io/badge/Gemini-Compatible-4285f4?style=flat-square)](https://ai.google)
[![Cursor](https://img.shields.io/badge/Cursor-Compatible-000?style=flat-square)](https://cursor.com)
[![Windsurf](https://img.shields.io/badge/Windsurf-Compatible-06b6d4?style=flat-square)](https://codeium.com)
[![Continue](https://img.shields.io/badge/Continue.dev-Compatible-e11d48?style=flat-square)](https://continue.dev)
[![Cline](https://img.shields.io/badge/Cline-Compatible-8b5cf6?style=flat-square)](https://github.com/cline/cline)

[English](#english) | [Instalacion](#instalacion) | [Guia Rapida](#guia-rapida) | [Herramientas](#herramientas) | [Documentacion](#documentacion)

---

</div>

## Que es CommerceHub MCP?

CommerceHub es un **servidor MCP (Model Context Protocol)** que permite a agentes de IA gestionar operaciones de e-commerce en multiples plataformas simultaneamente.

En lugar de alternar entre dashboards de Shopify, WooCommerce, Stripe y MercadoLibre, simplemente habla con tu agente de IA:

> *"Muestrame las ventas de hoy comparadas con ayer"*
>
> *"Que productos necesito reabastecer esta semana?"*
>
> *"Sincroniza el catalogo de Shopify a WooCommerce"*
>
> *"Procesa el reembolso de la orden #1234 porque el cliente recibio el producto danado"*

## Planes y precios

| | Free | Pro | Business |
|---|:---:|:---:|:---:|
| **Precio** | $0 | **$49/mes** | **$199/mes** |
| **Herramientas** | 15 (lectura) | 37 (todas) | 37 + futuras |
| **Plataformas** | 1 | 5 | Ilimitadas |
| **Requests/dia** | 100 | 10,000 | Ilimitados |
| **Productos** | Listar, ver, buscar | + Crear, editar, sync | Todo |
| **Ordenes** | Listar, ver | + Crear, fulfill, refund | Todo |
| **Analytics** | Revenue basico | + Forecast, conversion | Todo |
| **Soporte** | Community | Email | Prioritario |

[Comprar Pro](https://commercehub.gumroad.com) | [Comprar Business](https://commercehub.gumroad.com)

## Plataformas soportadas

| Plataforma | Productos | Ordenes | Inventario | Clientes | Analytics |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **Shopify** | Si | Si | Si | Si | Si |
| **WooCommerce** | Si | Si | Si | Si | Si |
| **Stripe** | Si | Si | - | Si | Si |
| **MercadoLibre** | Si | Si | Si | Si | Si |

## Clientes de IA compatibles

| Cliente | Tipo | Estado |
|:---:|:---:|:---:|
| **Claude Desktop** | App de escritorio | Soportado |
| **Claude Code** | CLI | Soportado |
| **ChatGPT** | via Open WebUI | Soportado |
| **Gemini** | Google AI Studio | Soportado |
| **Cursor** | IDE | Soportado |
| **Windsurf** | IDE (Codeium) | Soportado |
| **Continue.dev** | VS Code / JetBrains | Soportado |
| **Cline** | VS Code Extension | Soportado |

> CommerceHub usa el protocolo MCP estandar (stdio), por lo que es compatible con **cualquier cliente** que soporte Model Context Protocol.

## Arquitectura

```
  +----------+  +----------+  +----------+  +----------+
  |  Claude  |  | ChatGPT  |  |  Gemini  |  |  Cursor  |  ...
  | Desktop  |  | Open Web |  |  Studio  |  |   IDE    |
  +----+-----+  +----+-----+  +----+-----+  +----+-----+
       |              |              |              |
       +--------------+--------------+--------------+
                             |
                      MCP Protocol (stdio)
                             |
                    +--------+---------+
                    |   CommerceHub    |
                    |   MCP Server     |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |              |              |              |
   +-----+----+  +-----+----+  +------+-----+  +-----+------+
   |  Shopify |  |   Woo    |  |   Stripe   |  | MercadoLibre|
   |  Admin   |  | Commerce |  |    API     |  |    API      |
   +----------+  +----------+  +------------+  +-------------+
```

## Instalacion

### Requisitos previos

- **Node.js** 20 o superior
- **npm** 9 o superior
- Credenciales de al menos una plataforma (Shopify, WooCommerce, Stripe o MercadoLibre)

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/commercehub-mcp.git
cd commercehub-mcp
npm install
npm run build
```

### 2. Configurar credenciales

```bash
cp .env.example .env
# Edita .env con tus credenciales
```

### 3. Conectar con tu cliente de IA

CommerceHub es compatible con **todos los clientes MCP**:

<details>
<summary><strong>Claude Desktop</strong></summary>

Agrega a tu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "commercehub": {
      "command": "node",
      "args": ["/ruta/a/commercehub-mcp/dist/index.js"],
      "env": {
        "SHOPIFY_STORE_URL": "https://tu-tienda.myshopify.com",
        "SHOPIFY_ACCESS_TOKEN": "shpat_xxxxx"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add commercehub node /ruta/a/commercehub-mcp/dist/index.js
```
</details>

<details>
<summary><strong>ChatGPT (via Open WebUI)</strong></summary>

Open WebUI soporta MCP servers. Configura en Settings > Tools > MCP:

```json
{
  "mcpServers": {
    "commercehub": {
      "command": "node",
      "args": ["/ruta/a/commercehub-mcp/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><strong>Cursor IDE</strong></summary>

Agrega a `.cursor/mcp.json` en tu proyecto:

```json
{
  "mcpServers": {
    "commercehub": {
      "command": "node",
      "args": ["/ruta/a/commercehub-mcp/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><strong>Windsurf (Codeium)</strong></summary>

Agrega a `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "commercehub": {
      "command": "node",
      "args": ["/ruta/a/commercehub-mcp/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><strong>Continue.dev (VS Code / JetBrains)</strong></summary>

Agrega a `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: commercehub
    command: node
    args:
      - /ruta/a/commercehub-mcp/dist/index.js
```
</details>

<details>
<summary><strong>Cline (VS Code)</strong></summary>

En VS Code, abre Cline Settings > MCP Servers > Add:

```json
{
  "commercehub": {
    "command": "node",
    "args": ["/ruta/a/commercehub-mcp/dist/index.js"]
  }
}
```
</details>

<details>
<summary><strong>Gemini (Google AI Studio)</strong></summary>

Google AI Studio soporta MCP. Configura el server en la seccion de Tools:

```json
{
  "mcpServers": {
    "commercehub": {
      "command": "node",
      "args": ["/ruta/a/commercehub-mcp/dist/index.js"]
    }
  }
}
```
</details>

## Guia Rapida

Una vez conectado, prueba estos comandos:

```
"Lista mis productos de Shopify"
"Muestrame las ordenes pendientes de enviar"
"Cual es el revenue de esta semana?"
"Que productos tienen stock bajo?"
"Dame un reporte ejecutivo del dia"
```

## Herramientas

CommerceHub incluye **37 herramientas** organizadas en 5 categorias:

### Productos (9 herramientas)

| Herramienta | Descripcion |
|---|---|
| `products_list` | Lista productos con filtros avanzados (status, coleccion, vendor, precio) |
| `products_get` | Obtiene el detalle completo de un producto con variantes e imagenes |
| `products_create` | Crea un nuevo producto con variantes, imagenes y tags |
| `products_update` | Actualiza campos de un producto (precio, titulo, descripcion, status) |
| `products_delete` | Elimina o archiva un producto |
| `products_search` | Busqueda full-text en el catalogo con filtros |
| `products_bulk_price` | Actualizacion masiva de precios (por ID, SKU o porcentaje) |
| `products_sync` | Sincroniza el catalogo entre dos plataformas |
| `products_seo_audit` | Auditoria SEO de un producto con score y recomendaciones |

### Ordenes (8 herramientas)

| Herramienta | Descripcion |
|---|---|
| `orders_list` | Lista ordenes con filtros (status, fecha, monto, cliente) |
| `orders_get` | Detalle completo de una orden con line items y timeline |
| `orders_create` | Crea una orden manual/draft |
| `orders_fulfill` | Marca una orden como enviada con tracking |
| `orders_cancel` | Cancela una orden con razon y restock opcional |
| `orders_refund` | Procesa reembolso parcial o total |
| `orders_add_note` | Agrega nota interna a una orden |
| `orders_timeline` | Historial completo de eventos de la orden |

### Inventario (6 herramientas)

| Herramienta | Descripcion |
|---|---|
| `inventory_get` | Stock actual por SKU o producto |
| `inventory_update` | Actualiza cantidad de stock con razon |
| `inventory_bulk` | Actualizacion masiva de inventario |
| `inventory_low_stock` | Reporte de productos con stock bajo |
| `inventory_forecast` | Prediccion de agotamiento por velocidad de venta |
| `inventory_history` | Historial de movimientos de inventario |

### Clientes (6 herramientas)

| Herramienta | Descripcion |
|---|---|
| `customers_list` | Lista clientes con segmentacion automatica |
| `customers_get` | Perfil completo del cliente con estadisticas |
| `customers_search` | Busqueda por nombre, email o telefono |
| `customers_orders` | Historial de compras de un cliente |
| `customers_segments` | Segmentacion automatica (VIP, Regular, En Riesgo, Perdido) |
| `customers_lifetime_value` | Calculo de valor de vida del cliente (CLV) |

### Analytics (8 herramientas)

| Herramienta | Descripcion |
|---|---|
| `analytics_revenue` | Reporte de ingresos por periodo con comparacion |
| `analytics_top_products` | Ranking de productos mas vendidos |
| `analytics_by_channel` | Ventas desglosadas por plataforma |
| `analytics_conversion` | Embudo de conversion con tasas |
| `analytics_avg_order` | Ticket promedio con tendencia |
| `analytics_forecast` | Proyeccion de ventas (30/60/90 dias) |
| `analytics_refunds` | Analisis de reembolsos y razones |
| `analytics_dashboard` | Resumen ejecutivo completo de todas las metricas |

### Recursos MCP (3)

| Recurso | URI | Descripcion |
|---|---|---|
| Store Info | `commercehub://stores` | Informacion de tiendas conectadas |
| Recent Orders | `commercehub://orders/recent` | Ultimas ordenes en tiempo real |
| Inventory Alerts | `commercehub://inventory/alerts` | Alertas de stock bajo |

### Prompts Predefinidos (3)

| Prompt | Descripcion |
|---|---|
| `daily-report` | "Dame el reporte del dia" - Resumen ejecutivo completo |
| `order-summary` | "Resume las ordenes pendientes" - Ordenes que necesitan atencion |
| `inventory-check` | "Que necesito reabastecer?" - Analisis de inventario con predicciones |

## Caracteristicas Tecnicas

- **Multi-plataforma**: Conecta simultaneamente a Shopify, WooCommerce, Stripe y MercadoLibre
- **Cache inteligente**: Cache LRU con TTL configurable para respuestas rapidas
- **Rate limiting**: Respeta los limites de cada API automaticamente
- **Retry automatico**: Reintentos con backoff exponencial para resiliencia
- **Validacion estricta**: Todos los inputs validados con Zod
- **TypeScript strict**: Tipado completo sin `any`
- **Logs estructurados**: Logging JSON con pino para observabilidad
- **Extensible**: Patron adaptador para agregar proveedores facilmente

## Stack Tecnologico

| Tecnologia | Uso |
|---|---|
| TypeScript 5.7 | Lenguaje principal (strict mode) |
| @modelcontextprotocol/sdk | Framework MCP |
| Zod | Validacion de schemas |
| undici | Cliente HTTP de alto rendimiento |
| pino | Structured JSON logging |
| vitest | Testing framework |
| tsup | Build tool (esbuild) |

## Agregar un nuevo proveedor

CommerceHub usa el patron adaptador. Para agregar un nuevo proveedor:

1. Crea una carpeta en `src/providers/tu-proveedor/`
2. Implementa la clase extendiendo `BaseProvider`
3. Implementa el mapper para traducir datos
4. Registra el proveedor en `server.ts`

```typescript
// src/providers/amazon/amazon.provider.ts
import { BaseProvider } from '../base.provider.js';

export class AmazonProvider extends BaseProvider {
  readonly name = 'amazon' as const;

  protected buildUrl(path: string): string {
    return `https://sellingpartnerapi.amazon.com${path}`;
  }

  protected buildHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.accessToken}` };
  }

  // Implementar metodos...
}
```

Consulta [docs/PROVIDERS.md](docs/PROVIDERS.md) para la guia completa.

## Documentacion

| Documento | Descripcion |
|---|---|
| [SETUP.md](docs/SETUP.md) | Guia de instalacion paso a paso |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Variables de entorno y opciones |
| [API-REFERENCE.md](docs/API-REFERENCE.md) | Referencia de todas las herramientas |
| [PROVIDERS.md](docs/PROVIDERS.md) | Como agregar un nuevo proveedor |
| [MONETIZATION.md](docs/MONETIZATION.md) | Estrategia de monetizacion |

## Contribuir

1. Fork el repositorio
2. Crea tu rama: `git checkout -b feature/mi-feature`
3. Commit: `git commit -m 'Agrega mi feature'`
4. Push: `git push origin feature/mi-feature`
5. Crea un Pull Request

## Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

---

<div align="center">

<a name="english"></a>

## English

**CommerceHub MCP** is an AI-powered e-commerce operations platform built on the Model Context Protocol (MCP). It connects AI agents with multiple e-commerce platforms (Shopify, WooCommerce, Stripe, MercadoLibre) through 37 tools for managing products, orders, inventory, customers, and analytics from a single conversational interface.

### Key Features
- **37 MCP Tools** across 5 categories (Products, Orders, Inventory, Customers, Analytics)
- **4 Platform Integrations** (Shopify, WooCommerce, Stripe, MercadoLibre)
- **8 AI Client Compatible**: Claude, ChatGPT (Open WebUI), Gemini, Cursor, Windsurf, Continue.dev, Cline
- **3 Real-time Resources** (Store Info, Recent Orders, Inventory Alerts)
- **3 Pre-built Prompts** (Daily Report, Order Summary, Inventory Check)
- **Enterprise Features**: Smart caching, rate limiting, automatic retries, structured logging
- **TypeScript Strict Mode** with full Zod validation
- **Extensible Architecture**: Adapter pattern for easy provider addition

### Quick Start

```bash
npm install commercehub-mcp
```

```json
{
  "mcpServers": {
    "commercehub": {
      "command": "npx",
      "args": ["commercehub-mcp"],
      "env": {
        "SHOPIFY_STORE_URL": "https://your-store.myshopify.com",
        "SHOPIFY_ACCESS_TOKEN": "shpat_xxxxx"
      }
    }
  }
}
```

---

Built with TypeScript + Model Context Protocol

</div>
