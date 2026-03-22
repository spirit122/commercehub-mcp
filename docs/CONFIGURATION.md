# Configuracion - CommerceHub MCP

## Variables de Entorno

### Shopify
| Variable | Requerida | Descripcion |
|---|---|---|
| `SHOPIFY_STORE_URL` | Si | URL de tu tienda (https://xxx.myshopify.com) |
| `SHOPIFY_ACCESS_TOKEN` | Si | Token de acceso de la app |
| `SHOPIFY_API_KEY` | No | API Key (para OAuth2) |
| `SHOPIFY_API_SECRET` | No | API Secret (para OAuth2) |

### WooCommerce
| Variable | Requerida | Descripcion |
|---|---|---|
| `WOOCOMMERCE_URL` | Si | URL de tu tienda WordPress |
| `WOOCOMMERCE_CONSUMER_KEY` | Si | Consumer Key de la API |
| `WOOCOMMERCE_CONSUMER_SECRET` | Si | Consumer Secret de la API |

### Stripe
| Variable | Requerida | Descripcion |
|---|---|---|
| `STRIPE_SECRET_KEY` | Si | Secret Key (sk_live o sk_test) |

### MercadoLibre
| Variable | Requerida | Descripcion |
|---|---|---|
| `MERCADOLIBRE_APP_ID` | Si | ID de la aplicacion |
| `MERCADOLIBRE_CLIENT_SECRET` | Si | Client Secret |
| `MERCADOLIBRE_ACCESS_TOKEN` | Si | Token de acceso OAuth2 |
| `MERCADOLIBRE_REFRESH_TOKEN` | No | Refresh token para renovacion automatica |
| `MERCADOLIBRE_SITE_ID` | No | Sitio (MLA, MLM, MLB, etc. Default: MLM) |

### General
| Variable | Default | Descripcion |
|---|---|---|
| `LOG_LEVEL` | `info` | Nivel de log (debug, info, warn, error) |
| `CACHE_TTL` | `300` | TTL del cache en segundos |
| `CACHE_MAX_SIZE` | `1000` | Maximo de entries en cache |

## Notas

- Solo necesitas configurar las plataformas que uses
- Las credenciales se validan al iniciar el servidor
- El cache se puede desactivar poniendo `CACHE_TTL=0`
- Los logs en modo `debug` incluyen detalles de cada request HTTP
