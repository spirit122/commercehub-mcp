/**
 * @module providers/shopify/auth
 * @description Autenticación y validación de configuración para el proveedor Shopify.
 * Contiene constantes de la API, validación de credenciales y construcción de headers.
 */

import type { ProviderConfig } from '../../types/index.js';
import { CommerceHubError, ErrorCode } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Versión de la API REST Admin de Shopify utilizada. */
export const SHOPIFY_API_VERSION = '2024-01';

/** Scopes recomendados para la aplicación Shopify. */
export const SHOPIFY_SCOPES = [
  'read_products',
  'write_products',
  'read_orders',
  'write_orders',
  'read_customers',
  'read_inventory',
  'write_inventory',
  'read_fulfillments',
  'write_fulfillments',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que la configuración del proveedor Shopify contenga los campos requeridos.
 *
 * @param config - Configuración del proveedor a validar.
 * @returns `true` si la configuración es válida.
 * @throws {CommerceHubError} Si faltan campos requeridos.
 */
export function validateShopifyConfig(config: ProviderConfig): boolean {
  if (!config.storeUrl) {
    throw new CommerceHubError(
      'Shopify requiere storeUrl (ej: mi-tienda.myshopify.com)',
      ErrorCode.VALIDATION_ERROR,
      'shopify',
    );
  }

  if (!config.accessToken) {
    throw new CommerceHubError(
      'Shopify requiere accessToken (token de acceso de la API privada o app)',
      ErrorCode.VALIDATION_ERROR,
      'shopify',
    );
  }

  // Normalizar storeUrl: quitar protocolo y trailing slash
  if (config.storeUrl.startsWith('http://') || config.storeUrl.startsWith('https://')) {
    config.storeUrl = config.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Headers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye las cabeceras HTTP requeridas por la API REST Admin de Shopify.
 *
 * @param accessToken - Token de acceso de la API privada o app Shopify.
 * @returns Objeto con las cabeceras HTTP necesarias.
 */
export function buildShopifyHeaders(accessToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  };
}
