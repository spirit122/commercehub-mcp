# Referencia de API - CommerceHub MCP

## Parametro comun: provider

Todas las herramientas aceptan el parametro `provider` que indica la plataforma de e-commerce:
- `shopify` - Shopify Admin API
- `woocommerce` - WooCommerce REST API v3
- `stripe` - Stripe API
- `mercadolibre` - MercadoLibre API

---

## Productos

### products_list
Lista productos con filtros avanzados.

| Parametro | Tipo | Requerido | Default | Descripcion |
|---|---|---|---|---|
| provider | string | Si | - | Plataforma |
| status | string | No | - | active, draft, archived |
| collection | string | No | - | Filtrar por coleccion |
| vendor | string | No | - | Filtrar por vendedor |
| page | number | No | 1 | Pagina |
| limit | number | No | 20 | Items por pagina (max 100) |

### products_get
Obtiene el detalle completo de un producto.

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| product_id | string | Si | ID del producto |

### products_create
Crea un nuevo producto.

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| title | string | Si | Titulo del producto |
| description | string | No | Descripcion |
| price | number | Si | Precio |
| compare_at_price | number | No | Precio anterior (tachado) |
| sku | string | No | SKU |
| variants | string | No | JSON array de variantes |
| images | string | No | JSON array de URLs de imagenes |
| tags | string | No | Tags separados por coma |
| vendor | string | No | Vendedor |
| product_type | string | No | Tipo de producto |
| status | string | No | active o draft (default: draft) |

### products_update
Actualiza campos de un producto.

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| product_id | string | Si | ID del producto |
| title | string | No | Nuevo titulo |
| description | string | No | Nueva descripcion |
| price | number | No | Nuevo precio |
| tags | string | No | Nuevos tags |
| status | string | No | Nuevo status |

### products_delete
Elimina o archiva un producto.

| Parametro | Tipo | Requerido | Default | Descripcion |
|---|---|---|---|---|
| provider | string | Si | - | Plataforma |
| product_id | string | Si | - | ID del producto |
| archive_only | boolean | No | true | Solo archivar (no eliminar) |

### products_search
Busqueda full-text en el catalogo.

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| query | string | Si | Texto a buscar |
| min_price | number | No | Precio minimo |
| max_price | number | No | Precio maximo |
| status | string | No | Filtrar por status |
| limit | number | No | Max resultados (default 10) |

### products_bulk_price
Actualizacion masiva de precios.

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| updates | string | Si | JSON array de {product_id, new_price} o {sku, new_price} |
| apply_percentage | number | No | Si se da, aplica este % a todos los productos |

### products_sync
Sincroniza catalogo entre plataformas.

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| source_provider | string | Si | Plataforma origen |
| target_provider | string | Si | Plataforma destino |
| sync_mode | string | Si | all, new_only, prices_only |
| dry_run | boolean | No | Solo mostrar cambios sin aplicar (default: true) |

### products_seo_audit
Auditoria SEO de un producto.

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| product_id | string | Si | ID del producto |

---

## Ordenes

### orders_list
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| status | string | No | pending, processing, shipped, delivered, cancelled |
| financial_status | string | No | pending, paid, refunded |
| fulfillment_status | string | No | unfulfilled, partial, fulfilled |
| date_from | string | No | Fecha inicio (ISO 8601) |
| date_to | string | No | Fecha fin (ISO 8601) |
| customer_email | string | No | Filtrar por email del cliente |
| page | number | No | Pagina (default 1) |
| limit | number | No | Items por pagina (default 20) |

### orders_get
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| order_id | string | Si | ID de la orden |

### orders_fulfill
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| order_id | string | Si | ID de la orden |
| tracking_number | string | No | Numero de rastreo |
| tracking_company | string | No | Empresa de envio |
| tracking_url | string | No | URL de rastreo |
| notify_customer | boolean | No | Notificar al cliente (default: true) |

### orders_cancel
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| order_id | string | Si | ID de la orden |
| reason | string | No | customer, fraud, inventory, declined, other |
| restock | boolean | No | Devolver inventario (default: true) |

### orders_refund
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| order_id | string | Si | ID de la orden |
| amount | number | No | Monto a reembolsar (si no, reembolso total) |
| reason | string | No | Razon del reembolso |
| restock | boolean | No | Devolver inventario (default: true) |

### orders_add_note
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| order_id | string | Si | ID de la orden |
| note | string | Si | Contenido de la nota |
| notify_customer | boolean | No | Notificar (default: false) |

### orders_timeline
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| order_id | string | Si | ID de la orden |

---

## Inventario

### inventory_get
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| sku | string | No | SKU del producto |
| product_id | string | No | ID del producto |

### inventory_update
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| sku | string | Si | SKU del producto |
| quantity | number | Si | Nueva cantidad |
| reason | string | Si | received, sold, returned, adjustment, damaged, manual |

### inventory_low_stock
| Parametro | Tipo | Requerido | Default | Descripcion |
|---|---|---|---|---|
| provider | string | Si | - | Plataforma |
| threshold | number | No | 10 | Umbral de stock bajo |
| include_zero | boolean | No | true | Incluir agotados |

### inventory_forecast
| Parametro | Tipo | Requerido | Default | Descripcion |
|---|---|---|---|---|
| provider | string | Si | - | Plataforma |
| sku | string | No | - | SKU especifico (si no, todos) |
| days_ahead | number | No | 30 | Dias a proyectar |

---

## Clientes

### customers_list
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| segment | string | No | VIP, REGULAR, NEW, AT_RISK, LOST |
| min_orders | number | No | Minimo de ordenes |
| min_spent | number | No | Minimo gastado |
| page | number | No | Pagina |
| limit | number | No | Items por pagina |

### customers_lifetime_value
| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| provider | string | Si | Plataforma |
| customer_id | string | Si | ID del cliente |

---

## Analytics

### analytics_revenue
| Parametro | Tipo | Requerido | Default | Descripcion |
|---|---|---|---|---|
| provider | string | Si | - | Plataforma |
| period | string | Si | - | today, yesterday, this_week, this_month, this_year, custom |
| date_from | string | No | - | Para period=custom |
| date_to | string | No | - | Para period=custom |
| compare_previous | boolean | No | true | Comparar con periodo anterior |

### analytics_dashboard
| Parametro | Tipo | Requerido | Default | Descripcion |
|---|---|---|---|---|
| providers | string | No | todos | JSON array de providers |
| period | string | No | today | Periodo del reporte |
