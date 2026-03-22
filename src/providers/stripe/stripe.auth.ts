/**
 * @module providers/stripe/auth
 * @description Autenticación y validación de configuración para el proveedor Stripe.
 * Soporta autenticación vía Bearer Token con Secret Key.
 */

import type { ProviderConfig } from '../../types/index.js';
import { CommerceHubError, ErrorCode } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** URL base de la API de Stripe. */
export const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

/** Versión de la API de Stripe utilizada. */
export const STRIPE_API_VERSION = '2024-04-10';

// ─────────────────────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que la configuración del proveedor Stripe contenga los campos requeridos.
 *
 * @param config - Configuración del proveedor a validar.
 * @returns `true` si la configuración es válida.
 * @throws {CommerceHubError} Si faltan campos requeridos.
 */
export function validateStripeConfig(config: ProviderConfig): boolean {
  if (!config.apiKey) {
    throw new CommerceHubError(
      'Stripe requiere apiKey (Secret Key, ej: sk_live_xxxx o sk_test_xxxx)',
      ErrorCode.VALIDATION_ERROR,
      'stripe',
    );
  }

  if (!config.apiKey.startsWith('sk_')) {
    throw new CommerceHubError(
      'Stripe apiKey debe ser una Secret Key (comienza con sk_live_ o sk_test_)',
      ErrorCode.VALIDATION_ERROR,
      'stripe',
    );
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Headers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye las cabeceras HTTP para la API de Stripe.
 * Stripe espera Content-Type: application/x-www-form-urlencoded para POST/PUT,
 * pero para nuestra implementación usamos JSON con idempotency keys.
 *
 * @param secretKey - Stripe Secret Key.
 * @returns Objeto con las cabeceras HTTP necesarias.
 */
export function buildStripeHeaders(secretKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
}
