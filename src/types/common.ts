/**
 * @module common
 * @description Tipos compartidos y utilidades base para CommerceHub MCP Server.
 * Contiene definiciones fundamentales reutilizadas en todos los módulos del sistema.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Paginación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Respuesta paginada genérica.
 * Envuelve cualquier listado de recursos con metadatos de paginación.
 *
 * @typeParam T - Tipo de los elementos contenidos en la respuesta.
 *
 * @example
 * ```ts
 * const response: PaginatedResponse<Product> = {
 *   items: [producto1, producto2],
 *   total: 150,
 *   page: 1,
 *   limit: 20,
 *   hasMore: true,
 * };
 * ```
 */
export interface PaginatedResponse<T> {
  /** Lista de elementos de la página actual. */
  items: T[];
  /** Cantidad total de elementos disponibles (sin paginar). */
  total: number;
  /** Número de página actual (comienza en 1). */
  page: number;
  /** Cantidad máxima de elementos por página. */
  limit: number;
  /** Indica si existen más páginas después de la actual. */
  hasMore: boolean;
}

/**
 * Parámetros de paginación para solicitudes de listado.
 */
export interface PaginationParams {
  /** Número de página solicitada (por defecto: 1). */
  page?: number;
  /** Cantidad de elementos por página (por defecto: 20, máximo: 100). */
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rangos y valores monetarios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rango de fechas utilizado para filtros temporales.
 */
export interface DateRange {
  /** Fecha de inicio del rango (inclusiva). */
  from: Date;
  /** Fecha de fin del rango (inclusiva). */
  to: Date;
}

/**
 * Representación de un valor monetario con su divisa.
 * Utiliza `number` para el monto; se recomienda operar en la menor unidad
 * (ej. centavos) cuando la precisión sea crítica.
 *
 * @example
 * ```ts
 * const precio: Money = { amount: 29.99, currency: 'USD' };
 * ```
 */
export interface Money {
  /** Monto numérico del valor monetario. */
  amount: number;
  /** Código ISO 4217 de la divisa (ej. 'USD', 'EUR', 'ARS', 'MXN'). */
  currency: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordenamiento
// ─────────────────────────────────────────────────────────────────────────────

/** Dirección de ordenamiento para listados. */
export type SortDirection = 'asc' | 'desc';

// ─────────────────────────────────────────────────────────────────────────────
// Proveedores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nombres de los proveedores de comercio electrónico soportados.
 */
export type ProviderName = 'shopify' | 'woocommerce' | 'stripe' | 'mercadolibre';

// ─────────────────────────────────────────────────────────────────────────────
// Manejo de errores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Códigos de error estandarizados del sistema.
 * Permiten a los consumidores identificar programáticamente el tipo de fallo.
 */
export enum ErrorCode {
  /** Error genérico del proveedor externo. */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Fallo de autenticación o autorización contra el proveedor. */
  AUTH_ERROR = 'AUTH_ERROR',
  /** El recurso solicitado no fue encontrado. */
  NOT_FOUND = 'NOT_FOUND',
  /** Los datos de entrada no cumplen con las validaciones requeridas. */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** Se excedió el límite de peticiones permitidas (rate limit). */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Error de red o conectividad con el proveedor. */
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Error personalizado de CommerceHub.
 * Extiende `Error` nativo con información contextual del proveedor y código HTTP.
 *
 * @example
 * ```ts
 * throw new CommerceHubError(
 *   'Producto no encontrado en Shopify',
 *   ErrorCode.NOT_FOUND,
 *   'shopify',
 *   404,
 *   { productId: 'abc123' }
 * );
 * ```
 */
export class CommerceHubError extends Error {
  /** Código de error estandarizado del sistema. */
  public readonly code: ErrorCode;
  /** Nombre del proveedor donde se originó el error (si aplica). */
  public readonly provider?: ProviderName;
  /** Código de estado HTTP asociado al error. */
  public readonly statusCode?: number;
  /** Detalles adicionales para depuración. */
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    provider?: ProviderName,
    statusCode?: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CommerceHubError';
    this.code = code;
    this.provider = provider;
    this.statusCode = statusCode;
    this.details = details;

    // Restaurar la cadena de prototipos (necesario para clases que extienden Error en TS).
    Object.setPrototypeOf(this, CommerceHubError.prototype);
  }

  /**
   * Serializa el error a un objeto plano, útil para respuestas JSON.
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado de operación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resultado genérico de una operación que puede fallar de forma controlada.
 * Permite manejar éxito y error sin excepciones, siguiendo el patrón Result.
 *
 * @typeParam T - Tipo de los datos devueltos en caso de éxito.
 *
 * @example
 * ```ts
 * // Éxito
 * const ok: OperationResult<Product> = { success: true, data: producto };
 *
 * // Error
 * const fail: OperationResult<Product> = {
 *   success: false,
 *   error: 'No se pudo crear el producto',
 * };
 * ```
 */
export interface OperationResult<T> {
  /** Indica si la operación fue exitosa. */
  success: boolean;
  /** Datos resultantes de la operación (presente solo si `success` es `true`). */
  data?: T;
  /** Mensaje de error descriptivo (presente solo si `success` es `false`). */
  error?: string;
}
