/**
 * @module providers/mercadolibre/auth
 * @description Autenticación y validación de configuración para el proveedor MercadoLibre.
 * Incluye flujo OAuth2 con refresh automático de tokens.
 */

import { request } from 'undici';
import type { ProviderConfig } from '../../types/index.js';
import { CommerceHubError, ErrorCode } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** URL base de la API de MercadoLibre. */
export const MELI_BASE_URL = 'https://api.mercadolibre.com';

/** URL del endpoint OAuth de MercadoLibre. */
export const MELI_AUTH_URL = 'https://api.mercadolibre.com/oauth/token';

/** Site IDs de MercadoLibre por país. */
export const MELI_SITE_IDS: Record<string, string> = {
  AR: 'MLA',  // Argentina
  BR: 'MLB',  // Brasil
  MX: 'MLM',  // México
  CO: 'MCO',  // Colombia
  CL: 'MLC',  // Chile
  UY: 'MLU',  // Uruguay
  PE: 'MPE',  // Perú
  EC: 'MEC',  // Ecuador
  VE: 'MLV',  // Venezuela
  PA: 'MPA',  // Panamá
  DO: 'MRD',  // República Dominicana
  CR: 'MCR',  // Costa Rica
  GT: 'MGT',  // Guatemala
  HN: 'MHN',  // Honduras
  NI: 'MNI',  // Nicaragua
  SV: 'MSV',  // El Salvador
  BO: 'MBO',  // Bolivia
  PY: 'MPY',  // Paraguay
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que la configuración del proveedor MercadoLibre contenga los campos requeridos.
 *
 * @param config - Configuración del proveedor a validar.
 * @returns `true` si la configuración es válida.
 * @throws {CommerceHubError} Si faltan campos requeridos.
 */
export function validateMeliConfig(config: ProviderConfig): boolean {
  if (!config.accessToken) {
    throw new CommerceHubError(
      'MercadoLibre requiere accessToken (token de acceso OAuth2)',
      ErrorCode.VALIDATION_ERROR,
      'mercadolibre',
    );
  }

  // Para refresh automático necesitamos clientId, clientSecret y refreshToken
  if (config.refreshToken && (!config.clientId || !config.clientSecret)) {
    throw new CommerceHubError(
      'MercadoLibre requiere clientId y clientSecret para renovar tokens automáticamente',
      ErrorCode.VALIDATION_ERROR,
      'mercadolibre',
    );
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Headers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye las cabeceras HTTP para la API de MercadoLibre.
 *
 * @param accessToken - Token de acceso OAuth2.
 * @returns Objeto con las cabeceras HTTP necesarias.
 */
export function buildMeliHeaders(accessToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 - Refresh Token
// ─────────────────────────────────────────────────────────────────────────────

/** Respuesta del endpoint de refresh token de MercadoLibre. */
export interface MeliTokenResponse {
  /** Nuevo token de acceso. */
  access_token: string;
  /** Tipo de token (siempre 'Bearer'). */
  token_type: string;
  /** Tiempo de expiración en segundos. */
  expires_in: number;
  /** Scope del token. */
  scope: string;
  /** ID del usuario autenticado. */
  user_id: number;
  /** Nuevo refresh token (rotan con cada uso). */
  refresh_token: string;
}

/**
 * Renueva el token de acceso de MercadoLibre utilizando el refresh token.
 * Los refresh tokens de MercadoLibre son de un solo uso: cada vez que se
 * utiliza uno, se recibe un nuevo refresh token en la respuesta.
 *
 * @param clientId - ID de la aplicación de MercadoLibre.
 * @param clientSecret - Secret de la aplicación.
 * @param refreshToken - Refresh token actual.
 * @returns Objeto con el nuevo access_token y refresh_token.
 * @throws {CommerceHubError} Si falla la renovación del token.
 *
 * @example
 * ```ts
 * const tokens = await refreshMeliToken(
 *   '1234567890',
 *   'xxxxxxxxxxxx',
 *   'TG-xxxxxxxxxxxx'
 * );
 * // Guardar tokens.access_token y tokens.refresh_token para futuros usos
 * ```
 */
export async function refreshMeliToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<MeliTokenResponse> {
  try {
    const response = await request(MELI_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    const body = await response.body.text();
    const data = JSON.parse(body) as MeliTokenResponse & { error?: string; message?: string };

    if (response.statusCode >= 400 || data.error) {
      throw new CommerceHubError(
        `Error al renovar token de MercadoLibre: ${data.message ?? data.error ?? 'Unknown'}`,
        ErrorCode.AUTH_ERROR,
        'mercadolibre',
        response.statusCode,
        { error: data.error },
      );
    }

    return data;
  } catch (error) {
    if (error instanceof CommerceHubError) throw error;

    throw new CommerceHubError(
      `Error de red al renovar token de MercadoLibre: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCode.NETWORK_ERROR,
      'mercadolibre',
    );
  }
}

/**
 * Obtiene el site_id de MercadoLibre a partir del código de país ISO 3166-1 alpha-2.
 *
 * @param countryCode - Código de país (ej: 'AR', 'MX', 'BR').
 * @returns El site_id correspondiente o 'MLA' (Argentina) como default.
 */
export function getSiteId(countryCode?: string): string {
  if (!countryCode) return 'MLA';
  return MELI_SITE_IDS[countryCode.toUpperCase()] ?? 'MLA';
}
