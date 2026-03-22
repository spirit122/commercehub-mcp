/**
 * CommerceHub MCP - Configuración central
 *
 * Carga configuración desde variables de entorno.
 * Soporta múltiples proveedores simultáneamente.
 */

import type { ProviderConfig, ProviderName } from './types/index.js';

/** Configuración general del servidor */
export interface ServerConfig {
  /** Nivel de log */
  logLevel: string;
  /** TTL del cache en milisegundos */
  cacheTtl: number;
  /** Tamaño máximo del cache */
  cacheMaxSize: number;
}

/** Configuración completa de la aplicación */
export interface AppConfig {
  server: ServerConfig;
  providers: Map<ProviderName, ProviderConfig>;
}

/**
 * Carga la configuración desde variables de entorno.
 * Solo incluye proveedores que tengan credenciales configuradas.
 */
export function loadConfig(): AppConfig {
  const env = process.env;

  const server: ServerConfig = {
    logLevel: env.LOG_LEVEL ?? 'info',
    cacheTtl: parseInt(env.CACHE_TTL ?? '300', 10) * 1000,
    cacheMaxSize: parseInt(env.CACHE_MAX_SIZE ?? '1000', 10),
  };

  const providers = new Map<ProviderName, ProviderConfig>();

  // --- Shopify ---
  if (env.SHOPIFY_STORE_URL && env.SHOPIFY_ACCESS_TOKEN) {
    providers.set('shopify', {
      storeUrl: env.SHOPIFY_STORE_URL.replace(/\/$/, ''),
      accessToken: env.SHOPIFY_ACCESS_TOKEN,
      apiKey: env.SHOPIFY_API_KEY,
      apiSecret: env.SHOPIFY_API_SECRET,
    });
  }

  // --- WooCommerce ---
  if (env.WOOCOMMERCE_URL && env.WOOCOMMERCE_CONSUMER_KEY && env.WOOCOMMERCE_CONSUMER_SECRET) {
    providers.set('woocommerce', {
      storeUrl: env.WOOCOMMERCE_URL.replace(/\/$/, ''),
      apiKey: env.WOOCOMMERCE_CONSUMER_KEY,
      apiSecret: env.WOOCOMMERCE_CONSUMER_SECRET,
    });
  }

  // --- Stripe ---
  if (env.STRIPE_SECRET_KEY) {
    providers.set('stripe', {
      apiKey: env.STRIPE_SECRET_KEY,
    });
  }

  // --- MercadoLibre ---
  if (env.MERCADOLIBRE_ACCESS_TOKEN) {
    providers.set('mercadolibre', {
      accessToken: env.MERCADOLIBRE_ACCESS_TOKEN,
      refreshToken: env.MERCADOLIBRE_REFRESH_TOKEN,
      apiKey: env.MERCADOLIBRE_APP_ID,
      apiSecret: env.MERCADOLIBRE_CLIENT_SECRET,
      extra: {
        siteId: env.MERCADOLIBRE_SITE_ID ?? 'MLM',
      },
    });
  }

  return { server, providers };
}

/**
 * Obtiene los nombres de los proveedores configurados.
 */
export function getConfiguredProviders(config: AppConfig): ProviderName[] {
  return Array.from(config.providers.keys());
}

/**
 * Valida que al menos un proveedor esté configurado.
 */
export function validateConfig(config: AppConfig): { valid: boolean; message: string } {
  if (config.providers.size === 0) {
    return {
      valid: false,
      message: [
        'No hay proveedores configurados.',
        'Configura al menos uno en las variables de entorno:',
        '',
        '  Shopify:      SHOPIFY_STORE_URL + SHOPIFY_ACCESS_TOKEN',
        '  WooCommerce:  WOOCOMMERCE_URL + WOOCOMMERCE_CONSUMER_KEY + WOOCOMMERCE_CONSUMER_SECRET',
        '  Stripe:       STRIPE_SECRET_KEY',
        '  MercadoLibre: MERCADOLIBRE_ACCESS_TOKEN',
        '',
        'Consulta .env.example para más detalles.',
      ].join('\n'),
    };
  }

  return {
    valid: true,
    message: `Proveedores configurados: ${Array.from(config.providers.keys()).join(', ')}`,
  };
}
