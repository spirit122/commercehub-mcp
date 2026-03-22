/**
 * @module retry
 * @description Utilidad de reintentos con backoff exponencial y jitter aleatorio.
 * No reintenta errores 4xx (excepto 429 Too Many Requests) para evitar
 * bucles innecesarios ante errores de validación o autenticación.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Opciones de configuración para la estrategia de reintentos. */
export interface RetryOptions {
  /** Número máximo de reintentos (por defecto: 3). */
  maxRetries?: number;
  /** Delay base en milisegundos para el backoff exponencial (por defecto: 1000). */
  baseDelay?: number;
  /** Delay máximo en milisegundos (por defecto: 30000). */
  maxDelay?: number;
  /**
   * Función opcional que determina si se debe reintentar ante un error.
   * Si no se provee, se usa la lógica por defecto que excluye errores 4xx (excepto 429).
   */
  retryOn?: (error: unknown) => boolean;
  /**
   * Callback invocado antes de cada reintento, útil para logging.
   *
   * @param error - Error que causó el reintento.
   * @param attempt - Número de intento actual (1-based).
   * @param delayMs - Milisegundos que se esperará antes del próximo intento.
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/** Información contextual de un intento de reintento. */
export interface RetryAttemptInfo {
  /** Número de intento actual (1-based). */
  attempt: number;
  /** Delay aplicado antes de este intento (ms). */
  delayMs: number;
  /** Error que causó el reintento. */
  error: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Valores por defecto
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae el código de estado HTTP de un error, si está disponible.
 * Soporta múltiples convenciones: `statusCode`, `status`, `response.status`.
 *
 * @param error - Error del que extraer el código de estado.
 * @returns El código de estado HTTP o `undefined` si no se encuentra.
 */
function getStatusCode(error: unknown): number | undefined {
  if (error == null || typeof error !== 'object') return undefined;

  const err = error as Record<string, unknown>;

  // Convención directa: error.statusCode o error.status
  if (typeof err['statusCode'] === 'number') return err['statusCode'];
  if (typeof err['status'] === 'number') return err['status'];

  // Convención de respuesta HTTP: error.response.status
  if (err['response'] && typeof err['response'] === 'object') {
    const response = err['response'] as Record<string, unknown>;
    if (typeof response['status'] === 'number') return response['status'];
    if (typeof response['statusCode'] === 'number') return response['statusCode'];
  }

  return undefined;
}

/**
 * Determina si un error es retriable según la política por defecto.
 * No reintenta errores 4xx (client errors) excepto 429 (Too Many Requests)
 * y 408 (Request Timeout).
 *
 * @param error - Error a evaluar.
 * @returns `true` si se debe reintentar.
 */
export function isRetryableByDefault(error: unknown): boolean {
  const statusCode = getStatusCode(error);

  // Si no hay código de estado, asumir que es un error de red/transiente.
  if (statusCode === undefined) return true;

  // 429 Too Many Requests y 408 Request Timeout son retriables.
  if (statusCode === 429 || statusCode === 408) return true;

  // Otros errores 4xx no se reintentan (validación, autenticación, not found, etc.).
  if (statusCode >= 400 && statusCode < 500) return false;

  // Errores 5xx son retriables (errores de servidor transitorios).
  if (statusCode >= 500) return true;

  // Cualquier otro código (1xx, 2xx, 3xx) no debería llegar como error,
  // pero si lo hace, no reintentar.
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// withRetry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ejecuta una función asíncrona con reintentos automáticos usando
 * backoff exponencial con jitter aleatorio.
 *
 * @typeParam T - Tipo del valor retornado por la función.
 * @param fn - Función asíncrona a ejecutar.
 * @param options - Opciones de configuración de reintentos.
 * @returns El resultado de la función si tiene éxito.
 * @throws El último error si se agotan todos los reintentos o el error no es retriable.
 *
 * @example
 * ```ts
 * const producto = await withRetry(
 *   () => shopifyClient.getProduct('123'),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = DEFAULT_BASE_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    retryOn = isRetryableByDefault,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Si ya es el último intento o el error no es retriable, lanzar.
      if (attempt >= maxRetries || !retryOn(error)) {
        throw error;
      }

      // Calcular delay con backoff exponencial y jitter.
      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      const cappedDelay = Math.min(exponentialDelay, maxDelay);
      // Jitter: entre 0% y 100% del delay calculado (full jitter).
      const jitteredDelay = Math.floor(cappedDelay * Math.random());
      // Asegurar al menos un delay mínimo razonable.
      const finalDelay = Math.max(jitteredDelay, Math.min(baseDelay * 0.1, 100));

      // Notificar al callback de reintento si está definido.
      if (onRetry) {
        onRetry(error, attempt + 1, finalDelay);
      }

      await new Promise<void>((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  // Este punto solo se alcanza si maxRetries < 0, lo cual no debería pasar.
  throw lastError;
}

/**
 * Crea una versión con reintentos de una función asíncrona.
 * Útil para envolver funciones que se usan frecuentemente.
 *
 * @typeParam TArgs - Tipo de los argumentos de la función.
 * @typeParam TResult - Tipo del resultado de la función.
 * @param fn - Función a envolver.
 * @param options - Opciones de reintentos.
 * @returns Función envuelta con reintentos automáticos.
 *
 * @example
 * ```ts
 * const fetchWithRetry = withRetryWrapper(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 2 }
 * );
 * const data = await fetchWithRetry('/api/products');
 * ```
 */
export function withRetryWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {},
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}
