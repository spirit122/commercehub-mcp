/**
 * @module providers/woocommerce/auth
 * @description Autenticación y validación de configuración para el proveedor WooCommerce.
 * Soporta autenticación vía Basic Auth con Consumer Key y Consumer Secret.
 */

import type { ProviderConfig } from '../../types/index.js';
import { CommerceHubError, ErrorCode } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Versión de la API REST de WooCommerce utilizada. */
export const WOO_API_VERSION = 'wc/v3';

/** Base path de la API REST de WooCommerce. */
export const WOO_BASE_PATH = '/wp-json/wc/v3';

// ─────────────────────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que la configuración del proveedor WooCommerce contenga los campos requeridos.
 *
 * @param config - Configuración del proveedor a validar.
 * @returns `true` si la configuración es válida.
 * @throws {CommerceHubError} Si faltan campos requeridos.
 */
export function validateWooConfig(config: ProviderConfig): boolean {
  if (!config.storeUrl) {
    throw new CommerceHubError(
      'WooCommerce requiere storeUrl (ej: https://mi-tienda.com)',
      ErrorCode.VALIDATION_ERROR,
      'woocommerce',
    );
  }

  if (!config.apiKey || !config.apiSecret) {
    throw new CommerceHubError(
      'WooCommerce requiere apiKey (Consumer Key) y apiSecret (Consumer Secret)',
      ErrorCode.VALIDATION_ERROR,
      'woocommerce',
    );
  }

  // Normalizar URL
  config.storeUrl = config.storeUrl.replace(/\/$/, '');
  if (!config.storeUrl.startsWith('http')) {
    config.storeUrl = `https://${config.storeUrl}`;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el header de autenticación Basic Auth para WooCommerce.
 *
 * @param consumerKey - Consumer Key de la API de WooCommerce.
 * @param consumerSecret - Consumer Secret de la API de WooCommerce.
 * @returns String de autorización Basic Auth codificado en base64.
 */
export function buildWooAuth(consumerKey: string, consumerSecret: string): string {
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Construye las cabeceras HTTP para la API de WooCommerce.
 *
 * @param consumerKey - Consumer Key.
 * @param consumerSecret - Consumer Secret.
 * @returns Objeto con las cabeceras HTTP necesarias.
 */
export function buildWooHeaders(
  consumerKey: string,
  consumerSecret: string,
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': buildWooAuth(consumerKey, consumerSecret),
  };
}
