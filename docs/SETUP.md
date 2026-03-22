# Guia de Instalacion - CommerceHub MCP

## Requisitos

- Node.js 20+
- npm 9+
- Credenciales de al menos una plataforma

## Instalacion desde npm

```bash
npm install -g commercehub-mcp
```

## Instalacion desde codigo fuente

```bash
git clone https://github.com/tu-usuario/commercehub-mcp.git
cd commercehub-mcp
npm install
npm run build
```

## Configuracion de credenciales

### Shopify

1. Ve a tu admin de Shopify > Settings > Apps and sales channels
2. Click "Develop apps" > "Create an app"
3. Configura los scopes necesarios:
   - `read_products`, `write_products`
   - `read_orders`, `write_orders`
   - `read_inventory`, `write_inventory`
   - `read_customers`
4. Instala la app y copia el Access Token

```env
SHOPIFY_STORE_URL=https://tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxx
```

### WooCommerce

1. Ve a WooCommerce > Settings > Advanced > REST API
2. Click "Add Key"
3. Permisos: Read/Write
4. Copia Consumer Key y Consumer Secret

```env
WOOCOMMERCE_URL=https://tu-tienda.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxx
```

### Stripe

1. Ve a https://dashboard.stripe.com/apikeys
2. Copia tu Secret Key (sk_live_xxx o sk_test_xxx)

```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxx
```

### MercadoLibre

1. Ve a https://developers.mercadolibre.com
2. Crea una aplicacion
3. Genera tokens OAuth2

```env
MERCADOLIBRE_APP_ID=123456789
MERCADOLIBRE_CLIENT_SECRET=xxxxxxxx
MERCADOLIBRE_ACCESS_TOKEN=APP_USR-xxxxxxxx
MERCADOLIBRE_REFRESH_TOKEN=TG-xxxxxxxx
MERCADOLIBRE_SITE_ID=MLM
```

## Conexion con clientes de IA

CommerceHub es compatible con **todos los clientes MCP**. Selecciona el tuyo:

### Claude Desktop

Edita `claude_desktop_config.json` (ubicacion: `~/Library/Application Support/Claude/` en Mac, `%APPDATA%/Claude/` en Windows):

```json
{
  "mcpServers": {
    "commercehub": {
      "command": "node",
      "args": ["/ruta/completa/a/commercehub-mcp/dist/index.js"],
      "env": {
        "SHOPIFY_STORE_URL": "https://tu-tienda.myshopify.com",
        "SHOPIFY_ACCESS_TOKEN": "shpat_xxxxx"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add commercehub -- node /ruta/a/commercehub-mcp/dist/index.js
```

### ChatGPT (via Open WebUI)

Open WebUI soporta servidores MCP nativamente. Ve a Settings > Tools > MCP Servers:

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

### Gemini (Google AI Studio)

Google AI Studio soporta MCP servers. En la seccion Tools, configura:

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

### Cursor IDE

Crea el archivo `.cursor/mcp.json` en la raiz de tu proyecto:

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

### Windsurf (Codeium)

Edita `~/.codeium/windsurf/mcp_config.json`:

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

### Continue.dev (VS Code / JetBrains)

Edita `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: commercehub
    command: node
    args:
      - /ruta/a/commercehub-mcp/dist/index.js
    env:
      SHOPIFY_STORE_URL: https://tu-tienda.myshopify.com
      SHOPIFY_ACCESS_TOKEN: shpat_xxxxx
```

### Cline (VS Code Extension)

En VS Code, abre la paleta de comandos > Cline: MCP Settings:

```json
{
  "commercehub": {
    "command": "node",
    "args": ["/ruta/a/commercehub-mcp/dist/index.js"],
    "env": {
      "SHOPIFY_STORE_URL": "https://tu-tienda.myshopify.com",
      "SHOPIFY_ACCESS_TOKEN": "shpat_xxxxx"
    }
  }
}
```

## Verificacion

Despues de configurar cualquier cliente, prueba con:

```
"Lista las tiendas conectadas"
"Muestrame 5 productos de Shopify"
"Cuales son las ordenes pendientes?"
```

Si ves resultados, todo esta funcionando correctamente.
