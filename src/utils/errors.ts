/**
 * @module errors
 * @description Manejo centralizado de errores para CommerceHub MCP Server.
 * Provee funciones factory para crear errores tipados, detección de errores
 * retriables y formateo para respuestas MCP.
 */

import {
  CommerceHubError,
  ErrorCode,
  type ProviderName,
} from '../types/common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Re-exportaciones
// ─────────────────────────────────────────────────────────────────────────────

export { CommerceHubError, ErrorCode };

// ─────────────────────────────────────────────────────────────────────────────
// Funciones factory de errores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un error de recurso no encontrado.
 *
 * @param resource - Tipo de recurso (ej. 'Producto', 'Orden').
 * @param id - Identificador del recurso buscado.
 * @returns CommerceHubError con código NOT_FOUND.
 *
 * @example
 * ```ts
 * throw notFoundError('Producto', 'prod_123');
 * // → "Producto con id 'prod_123' no encontrado"
 * ```
 */
export function notFoundError(resource: string, id: string): CommerceHubError {
  return new CommerceHubError(
    `${resource} con id '${id}' no encontrado`,
    ErrorCode.NOT_FOUND,
    undefined,
    404,
    { resource, id },
  );
}

/**
 * Crea un error de autenticación o autorización.
 *
 * @param provider - Proveedor donde falló la autenticación.
 * @param message - Descripción del error de autenticación.
 * @returns CommerceHubError con código AUTH_ERROR.
 *
 * @example
 * ```ts
 * throw authError('shopify', 'Token de acceso inválido o expirado');
 * ```
 */
export function authError(provider: ProviderName, message: string): CommerceHubError {
  return new CommerceHubError(
    `Error de autenticación en ${provider}: ${message}`,
    ErrorCode.AUTH_ERROR,
    provider,
    401,
  );
}

/**
 * Crea un error de validación de datos.
 *
 * @param field - Campo o campos que fallaron la validación.
 * @param message - Descripción del error de validación.
 * @returns CommerceHubError con código VALIDATION_ERROR.
 *
 * @example
 * ```ts
 * throw validationError('price', 'El precio debe ser mayor a 0');
 * ```
 */
export function validationError(field: string, message: string): CommerceHubError {
  return new CommerceHubError(
    `Error de validación en '${field}': ${message}`,
    ErrorCode.VALIDATION_ERROR,
    undefined,
    400,
    { field },
  );
}

/**
 * Crea un error genérico de proveedor.
 *
 * @param provider - Proveedor donde ocurrió el error.
 * @param message - Descripción del error.
 * @param statusCode - Código HTTP del error (opcional).
 * @returns CommerceHubError con código PROVIDER_ERROR.
 *
 * @example
 * ```ts
 * throw providerError('stripe', 'Fallo al procesar el pago', 502);
 * ```
 */
export function providerError(
  provider: ProviderName,
  message: string,
  statusCode?: number,
): CommerceHubError {
  return new CommerceHubError(
    `Error del proveedor ${provider}: ${message}`,
    ErrorCode.PROVIDER_ERROR,
    provider,
    statusCode ?? 500,
  );
}

/**
 * Crea un error de rate limit excedido.
 *
 * @param provider - Proveedor que impuso el límite.
 * @param retryAfter - Segundos a esperar antes de reintentar (opcional).
 * @returns CommerceHubError con código RATE_LIMITED.
 *
 * @example
 * ```ts
 * throw rateLimitError('shopify', 2);
 * ```
 */
export function rateLimitError(
  provider: ProviderName,
  retryAfter?: number,
): CommerceHubError {
  const retryMsg = retryAfter != null ? ` Reintentar en ${retryAfter}s.` : '';
  return new CommerceHubError(
    `Límite de peticiones excedido en ${provider}.${retryMsg}`,
    ErrorCode.RATE_LIMITED,
    provider,
    429,
    retryAfter != null ? { retryAfter } : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de detección de errores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determina si un error es retriable (se puede reintentar la operación).
 *
 * Son retriables:
 * - Errores de red (NETWORK_ERROR)
 * - Errores de rate limit (RATE_LIMITED)
 * - Errores HTTP 5xx (errores de servidor)
 * - Errores HTTP 408 (Request Timeout)
 * - Errores HTTP 429 (Too Many Requests)
 * - Errores sin código de estado (posibles errores de red)
 *
 * No son retriables:
 * - Errores 4xx (excepto 408 y 429)
 * - Errores de validación
 * - Errores de autenticación
 * - Errores de recurso no encontrado
 *
 * @param error - Error a evaluar.
 * @returns `true` si la operación puede ser reintentada.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof CommerceHubError) {
    // Siempre retriable si es rate limit o error de red.
    if (error.code === ErrorCode.RATE_LIMITED || error.code === ErrorCode.NETWORK_ERROR) {
      return true;
    }

    // No reintentar errores de validación, auth o not found.
    if (
      error.code === ErrorCode.VALIDATION_ERROR ||
      error.code === ErrorCode.AUTH_ERROR ||
      error.code === ErrorCode.NOT_FOUND
    ) {
      return false;
    }

    // Para errores de proveedor, evaluar el código HTTP.
    if (error.statusCode != null) {
      if (error.statusCode === 429 || error.statusCode === 408) return true;
      if (error.statusCode >= 400 && error.statusCode < 500) return false;
      if (error.statusCode >= 500) return true;
    }

    // Provider errors sin statusCode son retriables por defecto.
    return error.code === ErrorCode.PROVIDER_ERROR;
  }

  // Para errores genéricos, evaluar si tienen statusCode.
  if (error != null && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const status =
      (typeof err['statusCode'] === 'number' ? err['statusCode'] : undefined) ??
      (typeof err['status'] === 'number' ? err['status'] : undefined);

    if (status != null) {
      if (status === 429 || status === 408) return true;
      if (status >= 400 && status < 500) return false;
      if (status >= 500) return true;
    }
  }

  // Errores desconocidos se asumen retriables (posible error de red).
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formateo para MCP
// ─────────────────────────────────────────────────────────────────────────────

/** Respuesta de error formateada para el protocolo MCP. */
export interface MCPErrorResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
}

/**
 * Formatea un error para ser devuelto como respuesta MCP.
 * Produce un formato consistente con el protocolo Model Context Protocol.
 *
 * @param error - Error a formatear.
 * @returns Objeto con la estructura de respuesta de error MCP.
 *
 * @example
 * ```ts
 * try {
 *   const product = await provider.getProduct('123');
 * } catch (error) {
 *   return formatErrorForMCP(error);
 * }
 * ```
 */
export function formatErrorForMCP(error: unknown): MCPErrorResponse {
  let message: string;

  if (error instanceof CommerceHubError) {
    const parts = [`Error [${error.code}]: ${error.message}`];
    if (error.provider) parts.push(`Proveedor: ${error.provider}`);
    if (error.statusCode) parts.push(`HTTP ${error.statusCode}`);
    if (error.details) {
      parts.push(`Detalles: ${JSON.stringify(error.details)}`);
    }
    message = parts.join('\n');
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = `Error desconocido: ${String(error)}`;
  }

  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de errores HTTP de proveedor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapea un error HTTP de un proveedor a un CommerceHubError tipado.
 * Analiza el código de estado HTTP y crea el error más específico posible.
 *
 * @param error - Error original del proveedor (puede ser cualquier tipo).
 * @param provider - Nombre del proveedor donde ocurrió el error.
 * @returns CommerceHubError con código y statusCode apropiados.
 *
 * @example
 * ```ts
 * try {
 *   await shopifyApi.get('/products/123');
 * } catch (error) {
 *   throw handleProviderError(error, 'shopify');
 * }
 * ```
 */
export function handleProviderError(
  error: unknown,
  provider: ProviderName,
): CommerceHubError {
  // Si ya es un CommerceHubError, retornar directamente.
  if (error instanceof CommerceHubError) {
    return error;
  }

  // Extraer información del error.
  const message = error instanceof Error ? error.message : String(error);
  let statusCode: number | undefined;

  if (error != null && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    statusCode =
      (typeof err['statusCode'] === 'number' ? err['statusCode'] : undefined) ??
      (typeof err['status'] === 'number' ? err['status'] : undefined);

    // Intentar extraer de error.response
    if (statusCode === undefined && err['response'] && typeof err['response'] === 'object') {
      const response = err['response'] as Record<string, unknown>;
      statusCode =
        (typeof response['status'] === 'number' ? response['status'] : undefined) ??
        (typeof response['statusCode'] === 'number' ? response['statusCode'] : undefined);
    }
  }

  // Mapear según código de estado HTTP.
  if (statusCode != null) {
    switch (statusCode) {
      case 401:
      case 403:
        return new CommerceHubError(
          `Error de autenticación en ${provider}: ${message}`,
          ErrorCode.AUTH_ERROR,
          provider,
          statusCode,
        );

      case 404:
        return new CommerceHubError(
          `Recurso no encontrado en ${provider}: ${message}`,
          ErrorCode.NOT_FOUND,
          provider,
          404,
        );

      case 422:
      case 400:
        return new CommerceHubError(
          `Error de validación en ${provider}: ${message}`,
          ErrorCode.VALIDATION_ERROR,
          provider,
          statusCode,
        );

      case 429:
        return new CommerceHubError(
          `Límite de peticiones excedido en ${provider}: ${message}`,
          ErrorCode.RATE_LIMITED,
          provider,
          429,
        );

      default:
        if (statusCode >= 500) {
          return new CommerceHubError(
            `Error del servidor de ${provider}: ${message}`,
            ErrorCode.PROVIDER_ERROR,
            provider,
            statusCode,
          );
        }

        return new CommerceHubError(
          `Error en ${provider} (HTTP ${statusCode}): ${message}`,
          ErrorCode.PROVIDER_ERROR,
          provider,
          statusCode,
        );
    }
  }

  // Detectar errores de red comunes.
  const networkPatterns = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'fetch failed',
    'network',
    'socket hang up',
    'ECONNABORTED',
  ];

  const lowerMessage = message.toLowerCase();
  const isNetworkError = networkPatterns.some((pattern) =>
    lowerMessage.includes(pattern.toLowerCase()),
  );

  if (isNetworkError) {
    return new CommerceHubError(
      `Error de red al conectar con ${provider}: ${message}`,
      ErrorCode.NETWORK_ERROR,
      provider,
    );
  }

  // Error genérico de proveedor.
  return new CommerceHubError(
    `Error inesperado en ${provider}: ${message}`,
    ErrorCode.PROVIDER_ERROR,
    provider,
  );
}
