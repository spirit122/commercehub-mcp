# Estrategia de Monetizacion - CommerceHub MCP

## Modelo de negocio: Freemium + SaaS

### Planes activos (LemonSqueezy)

| Plan | Precio | Incluye | Link |
|---|---|---|---|
| **Free** | $0 | 15 tools (lectura), 1 plataforma, 100 req/dia | Incluido |
| **Pro** | $45.000 CLP/mes | 37 tools, 5 plataformas, 10K req/dia, sync, forecast | [Comprar](https://spirit122.lemonsqueezy.com/checkout/buy/71006653-b5bc-4c7e-a91e-4e120397b980) |
| **Business** | $185.000 CLP/mes | Todo ilimitado, soporte prioritario | [Comprar](https://spirit122.lemonsqueezy.com/checkout/buy/6a8a34e1-a4d5-4d56-aa73-6e4a7fa73764) |
| **Pro Lifetime** | $275.000 CLP (unico) | Todo lo de Pro, sin pagos recurrentes | [Comprar](https://spirit122.lemonsqueezy.com/checkout/buy/4a46887b-d7d8-40cf-ad61-a5bc41e1a524) |

### Comparacion detallada

| Caracteristica | Free | Pro | Business |
|---|:---:|:---:|:---:|
| Herramientas | 15 (lectura) | 37 (todas) | 37 + futuras |
| Plataformas | 1 | 5 | Ilimitadas |
| Requests/dia | 100 | 10,000 | Ilimitados |
| Productos: listar, ver, buscar | Si | Si | Si |
| Productos: crear, editar, eliminar | No | Si | Si |
| Productos: sync entre plataformas | No | Si | Si |
| Productos: auditoria SEO | No | Si | Si |
| Ordenes: listar, ver, timeline | Si | Si | Si |
| Ordenes: crear, fulfill, cancel, refund | No | Si | Si |
| Inventario: ver, stock bajo | Si | Si | Si |
| Inventario: editar, masivo, forecast | No | Si | Si |
| Clientes: listar, ver, buscar | Si | Si | Si |
| Clientes: segmentos, CLV, historial | No | Si | Si |
| Analytics: revenue, top, AOV, dashboard | Si | Si | Si |
| Analytics: forecast, conversion, canales | No | Si | Si |
| Soporte | Community | Email | Prioritario |

### Flujo de conversion (freemium)

```
Instala gratis (npx commercehub-mcp)
         |
    Usa 15 tools gratis
         |
    Intenta crear/editar
         |
    Ve mensaje: "Requiere Pro - Compra aqui: [link]"
         |
    Compra en LemonSqueezy
         |
    Recibe license key por email
         |
    Agrega COMMERCEHUB_LICENSE_KEY=key
         |
    37 tools desbloqueadas
```

### Seguridad del sistema de licencias

- Validacion online contra API de LemonSqueezy
- Cache encriptado AES-256-GCM vinculado a la maquina
- Machine fingerprinting (hostname + user + platform + CPU)
- Anti-tampering con hash de integridad
- Grace period de 7 dias sin internet
- License key nunca se guarda en texto plano

### Metricas clave del mercado

- **TAM**: 26M tiendas e-commerce activas globalmente
- **SAM**: ~5M tiendas que usan multiples plataformas
- **SOM**: 0.01% = 2,600 clientes potenciales en Y1

### Proyeccion de revenue (CLP)

| Ano | Clientes | MRR | ARR |
|---|---|---|---|
| Y1 | 100 Pro + 10 Business | $6.35M CLP | $76.2M CLP |
| Y2 | 400 Pro + 40 Business | $25.4M CLP | $304.8M CLP |
| Y3 | 1,000 Pro + 100 Business | $63.5M CLP | $762M CLP |

### Canales de distribucion

1. **npm** - `npm i commercehub-mcp` (activo)
2. **GitHub** - github.com/spirit122/commercehub-mcp (activo)
3. **LemonSqueezy** - spirit122.lemonsqueezy.com (activo)
4. **MCP Marketplace** - Pendiente submit
5. **Smithery.ai** - Pendiente submit
6. **Glama.ai** - Pendiente submit
7. **LinkedIn** - Pendiente post de lanzamiento
8. **Product Hunt** - Pendiente lanzamiento

### Costos operativos

| Item | Costo mensual |
|---|---|
| Infraestructura | $0 (ejecuta en maquina del cliente) |
| LemonSqueezy comision | 5% + $0.50 por transaccion |
| npm hosting | $0 (paquete publico) |
| GitHub | $0 (repositorio publico) |
| Marketing | Variable |
| **Total fijo** | **~$0** |

### Margen bruto: ~95%

El producto ejecuta en la infraestructura del cliente (MCP server local). No hay costos de servidor. Solo la comision de LemonSqueezy (5%).
