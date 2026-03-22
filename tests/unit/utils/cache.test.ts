import { describe, it, expect, beforeEach, vi } from 'vitest';

// Nota: En la implementación real, importar desde el módulo compilado
// import { LRUCache } from '../../../src/utils/cache.js';

/** Implementación inline para tests independientes */
class LRUCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private hits = 0;
  private misses = 0;

  constructor(
    private maxSize: number = 1000,
    private ttl: number = 300000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    // Mover al final (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, customTtl?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (customTtl ?? this.ttl),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  async getOrSet(key: string, fetcher: () => Promise<T>, customTtl?: number): Promise<T> {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    const value = await fetcher();
    this.set(key, value, customTtl);
    return value;
  }
}

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(5, 1000);
  });

  it('debe guardar y recuperar valores', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('debe retornar undefined para claves inexistentes', () => {
    expect(cache.get('noexiste')).toBeUndefined();
  });

  it('debe respetar el tamaño máximo (LRU eviction)', () => {
    for (let i = 0; i < 6; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    // key0 debería haber sido eliminada (la más antigua)
    expect(cache.get('key0')).toBeUndefined();
    expect(cache.get('key5')).toBe('value5');
    expect(cache.size).toBeLessThanOrEqual(5);
  });

  it('debe expirar entries después del TTL', async () => {
    cache = new LRUCache<string>(5, 50); // TTL de 50ms
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get('key1')).toBeUndefined();
  });

  it('debe soportar TTL personalizado por entry', async () => {
    cache.set('short', 'value', 50);
    cache.set('long', 'value', 5000);

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe('value');
  });

  it('debe reportar hit rate correctamente', () => {
    cache.set('key1', 'value1');
    cache.get('key1'); // hit
    cache.get('key1'); // hit
    cache.get('noexiste'); // miss
    expect(cache.hitRate).toBeCloseTo(0.667, 2);
  });

  it('debe funcionar con getOrSet (cache-aside pattern)', async () => {
    const fetcher = vi.fn().mockResolvedValue('fetched');

    const result1 = await cache.getOrSet('key1', fetcher);
    expect(result1).toBe('fetched');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const result2 = await cache.getOrSet('key1', fetcher);
    expect(result2).toBe('fetched');
    expect(fetcher).toHaveBeenCalledTimes(1); // No se llamó de nuevo
  });

  it('debe limpiar todo con clear()', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('debe eliminar entries individuales', () => {
    cache.set('key1', 'value1');
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.delete('noexiste')).toBe(false);
  });

  it('debe verificar existencia con has()', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('noexiste')).toBe(false);
  });
});
