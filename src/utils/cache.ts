/**
 * @module cache
 * @description Cache LRU (Least Recently Used) con soporte de TTL (Time To Live).
 * Proporciona almacenamiento en memoria con expiración automática, estadísticas
 * de rendimiento y patrón cache-aside mediante getOrSet.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────

/** Entrada interna del cache con metadatos de expiración. */
interface CacheEntry<T> {
  /** Valor almacenado. */
  value: T;
  /** Timestamp (ms) en el que la entrada expira. */
  expiresAt: number;
}

/** Estadísticas de rendimiento del cache. */
export interface CacheStats {
  /** Cantidad de aciertos (hits). */
  hits: number;
  /** Cantidad de fallos (misses). */
  misses: number;
  /** Tasa de aciertos (0.0 a 1.0). */
  hitRate: number;
  /** Cantidad actual de entradas en el cache. */
  size: number;
}

/** Opciones de configuración para el LRUCache. */
export interface LRUCacheOptions {
  /** Cantidad máxima de entradas permitidas (por defecto: 1000). */
  maxSize?: number;
  /** Tiempo de vida por defecto en milisegundos (por defecto: 300000 = 5 min). */
  ttl?: number;
  /** Intervalo en ms para la limpieza automática de entradas expiradas (por defecto: 60000 = 1 min). */
  cleanupInterval?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Valores por defecto
// ─────────────────────────────────────────────────────────────────────────────

/** Tamaño máximo por defecto del cache. */
const DEFAULT_MAX_SIZE = 1000;

/** TTL por defecto en milisegundos (5 minutos). */
const DEFAULT_TTL = 300_000;

/** Intervalo de limpieza por defecto en milisegundos (1 minuto). */
const DEFAULT_CLEANUP_INTERVAL = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// LRUCache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache LRU genérico con soporte de TTL.
 *
 * Utiliza un `Map` nativo de JavaScript que mantiene el orden de inserción,
 * lo que permite implementar la política LRU de forma eficiente: cada acceso
 * mueve la entrada al final del mapa (más reciente).
 *
 * @typeParam T - Tipo de los valores almacenados en el cache.
 *
 * @example
 * ```ts
 * const cache = new LRUCache<string>({ maxSize: 100, ttl: 60_000 });
 * cache.set('clave', 'valor');
 * const valor = cache.get('clave'); // 'valor'
 * ```
 */
export class LRUCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Contador de aciertos. */
  private hitCount = 0;
  /** Contador de fallos. */
  private missCount = 0;

  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.defaultTtl = options.ttl ?? DEFAULT_TTL;

    if (this.maxSize < 1) {
      throw new Error('LRUCache: maxSize debe ser al menos 1');
    }
    if (this.defaultTtl < 0) {
      throw new Error('LRUCache: ttl no puede ser negativo');
    }

    const interval = options.cleanupInterval ?? DEFAULT_CLEANUP_INTERVAL;
    if (interval > 0) {
      this.cleanupTimer = setInterval(() => this.evictExpired(), interval);
      // Permitir que el proceso de Node.js termine sin esperar al timer.
      if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
        this.cleanupTimer.unref();
      }
    }
  }

  // ──────────────────────── Métodos públicos ────────────────────────

  /**
   * Obtiene un valor del cache.
   * Si la entrada existe y no ha expirado, se mueve al final (más reciente).
   *
   * @param key - Clave de la entrada.
   * @returns El valor almacenado o `undefined` si no existe o expiró.
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this.missCount++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.missCount++;
      return undefined;
    }

    // Mover al final para mantener política LRU.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hitCount++;

    return entry.value;
  }

  /**
   * Almacena un valor en el cache.
   * Si el cache está lleno, elimina la entrada menos recientemente usada.
   *
   * @param key - Clave de la entrada.
   * @param value - Valor a almacenar.
   * @param customTtl - TTL personalizado en ms (opcional, usa el default si no se provee).
   */
  set(key: string, value: T, customTtl?: number): void {
    // Si la clave ya existe, eliminar para actualizar posición.
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    // Evictar la entrada más antigua si se alcanzó el límite.
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value as string;
      this.store.delete(oldestKey);
    }

    const ttl = customTtl ?? this.defaultTtl;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Verifica si una clave existe en el cache y no ha expirado.
   *
   * @param key - Clave a verificar.
   * @returns `true` si la entrada existe y es válida.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Elimina una entrada del cache.
   *
   * @param key - Clave de la entrada a eliminar.
   * @returns `true` si la entrada existía y fue eliminada.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Elimina todas las entradas del cache y reinicia las estadísticas.
   */
  clear(): void {
    this.store.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /** Cantidad actual de entradas almacenadas (incluye posibles expiradas aún no limpiadas). */
  get size(): number {
    return this.store.size;
  }

  /**
   * Retorna un iterador con todas las claves actualmente en el cache.
   * Nota: puede incluir claves expiradas que aún no fueron limpiadas.
   */
  keys(): IterableIterator<string> {
    return this.store.keys();
  }

  /**
   * Obtiene un valor del cache o lo genera y almacena si no existe.
   * Implementa el patrón cache-aside de forma atómica.
   *
   * @param key - Clave de la entrada.
   * @param fetcher - Función asíncrona que genera el valor si no está en cache.
   * @param customTtl - TTL personalizado en ms (opcional).
   * @returns El valor del cache o el resultado del fetcher.
   */
  async getOrSet(key: string, fetcher: () => Promise<T>, customTtl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, customTtl);
    return value;
  }

  /**
   * Retorna las estadísticas de rendimiento del cache.
   */
  stats(): CacheStats {
    const total = this.hitCount + this.missCount;
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total === 0 ? 0 : this.hitCount / total,
      size: this.store.size,
    };
  }

  /**
   * Detiene el timer de limpieza automática.
   * Llamar cuando el cache ya no sea necesario para evitar memory leaks.
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ──────────────────────── Métodos privados ────────────────────────

  /**
   * Elimina todas las entradas expiradas del cache.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
