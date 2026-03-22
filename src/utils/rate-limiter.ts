/**
 * @module rate-limiter
 * @description Rate limiter basado en token bucket para controlar la frecuencia
 * de peticiones a proveedores de e-commerce. Incluye presets por proveedor
 * y tracking de requests realizados.
 */

import type { ProviderName } from '../types/common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Opciones de configuración para el RateLimiter. */
export interface RateLimiterOptions {
  /** Cantidad de tokens generados por segundo. */
  tokensPerSecond: number;
  /** Capacidad máxima del bucket (ráfaga permitida). */
  bucketSize: number;
}

/** Estadísticas del rate limiter. */
export interface RateLimiterStats {
  /** Total de requests procesados. */
  totalRequests: number;
  /** Tokens disponibles actualmente. */
  availableTokens: number;
  /** Cantidad de veces que un acquire tuvo que esperar. */
  totalWaits: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets por proveedor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Presets de rate limiting por proveedor, basados en los límites
 * documentados de cada API.
 */
const PROVIDER_PRESETS: Record<ProviderName, RateLimiterOptions> = {
  /** Shopify: 2 requests/segundo (REST Admin API, plan básico). */
  shopify: { tokensPerSecond: 2, bucketSize: 4 },
  /** WooCommerce: ~5 requests/segundo (límite típico de hosting compartido). */
  woocommerce: { tokensPerSecond: 5, bucketSize: 10 },
  /** Stripe: 25 requests/segundo (modo live, read operations). */
  stripe: { tokensPerSecond: 25, bucketSize: 50 },
  /** MercadoLibre: ~10 requests/segundo (depende de la aplicación). */
  mercadolibre: { tokensPerSecond: 10, bucketSize: 20 },
};

// ─────────────────────────────────────────────────────────────────────────────
// RateLimiter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limiter basado en el algoritmo token bucket.
 *
 * Los tokens se generan a una tasa constante hasta llenar el bucket.
 * Cada request consume un token. Si no hay tokens disponibles,
 * `acquire()` espera hasta que se genere uno.
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter({ tokensPerSecond: 2, bucketSize: 4 });
 * await limiter.acquire(); // Espera si no hay tokens.
 * // Realizar la petición...
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private lastRefillTime: number;
  private requestCount = 0;
  private waitCount = 0;

  constructor(options: RateLimiterOptions) {
    if (options.tokensPerSecond <= 0) {
      throw new Error('RateLimiter: tokensPerSecond debe ser mayor a 0');
    }
    if (options.bucketSize < 1) {
      throw new Error('RateLimiter: bucketSize debe ser al menos 1');
    }

    this.maxTokens = options.bucketSize;
    this.tokens = options.bucketSize;
    this.refillRate = options.tokensPerSecond;
    this.lastRefillTime = Date.now();
  }

  /**
   * Adquiere un token del bucket. Si no hay tokens disponibles,
   * espera el tiempo necesario hasta que se genere uno.
   *
   * @returns Promesa que se resuelve cuando el token es adquirido.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.requestCount++;
      return;
    }

    // Calcular tiempo de espera hasta tener al menos 1 token.
    const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
    this.waitCount++;

    await this.sleep(waitMs);

    this.refill();
    this.tokens = Math.max(0, this.tokens - 1);
    this.requestCount++;
  }

  /**
   * Intenta adquirir un token sin esperar.
   *
   * @returns `true` si se obtuvo un token, `false` si no hay disponibles.
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.requestCount++;
      return true;
    }

    return false;
  }

  /**
   * Retorna las estadísticas del rate limiter.
   */
  stats(): RateLimiterStats {
    this.refill();
    return {
      totalRequests: this.requestCount,
      availableTokens: Math.floor(this.tokens),
      totalWaits: this.waitCount,
    };
  }

  /**
   * Reinicia el bucket a su capacidad máxima y resetea contadores.
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
    this.requestCount = 0;
    this.waitCount = 0;
  }

  // ──────────────────────── Métodos privados ────────────────────────

  /**
   * Rellena el bucket con tokens generados desde la última recarga.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefillTime) / 1000;
    const newTokens = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefillTime = now;
  }

  /**
   * Espera el tiempo indicado en milisegundos.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.ceil(ms)));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry de rate limiters por proveedor
// ─────────────────────────────────────────────────────────────────────────────

/** Cache de instancias de RateLimiter por proveedor. */
const limiterRegistry = new Map<ProviderName, RateLimiter>();

/**
 * Obtiene (o crea) un rate limiter para el proveedor indicado.
 * Las instancias se reutilizan para mantener el estado del bucket
 * a lo largo de la vida del proceso.
 *
 * @param provider - Nombre del proveedor de e-commerce.
 * @returns Instancia de RateLimiter configurada para el proveedor.
 *
 * @example
 * ```ts
 * const limiter = getRateLimiter('shopify');
 * await limiter.acquire();
 * ```
 */
export function getRateLimiter(provider: ProviderName): RateLimiter {
  let limiter = limiterRegistry.get(provider);
  if (!limiter) {
    const preset = PROVIDER_PRESETS[provider];
    limiter = new RateLimiter(preset);
    limiterRegistry.set(provider, limiter);
  }
  return limiter;
}

/**
 * Crea un rate limiter con opciones personalizadas.
 * Útil cuando los límites del proveedor difieren de los presets.
 *
 * @param options - Opciones de configuración.
 * @returns Nueva instancia de RateLimiter.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}

/**
 * Resetea todas las instancias del registry de rate limiters.
 * Útil para testing o tras cambios de configuración.
 */
export function resetAllRateLimiters(): void {
  limiterRegistry.clear();
}
