/**
 * @module pagination
 * @description Utilidades de paginación para CommerceHub MCP Server.
 * Proporciona funciones para paginar arrays en memoria, construir
 * metadatos de paginación y fusionar resultados paginados.
 */

import type { PaginatedResponse, PaginationParams } from '../types/common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Valores por defecto
// ─────────────────────────────────────────────────────────────────────────────

/** Página por defecto. */
const DEFAULT_PAGE = 1;

/** Límite por defecto de elementos por página. */
const DEFAULT_LIMIT = 20;

/** Límite máximo permitido de elementos por página. */
const MAX_LIMIT = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos auxiliares
// ─────────────────────────────────────────────────────────────────────────────

/** Información calculada de paginación. */
export interface PaginationInfo {
  /** Indica si hay más páginas disponibles. */
  hasMore: boolean;
  /** Cantidad total de páginas. */
  totalPages: number;
  /** Página actual. */
  currentPage: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza y valida los parámetros de paginación.
 * Aplica valores por defecto y asegura que los valores estén dentro de rangos válidos.
 *
 * @param params - Parámetros de paginación opcionales.
 * @returns Parámetros normalizados con page y limit definidos.
 */
function normalizeParams(params?: PaginationParams): Required<PaginationParams> {
  const page = Math.max(DEFAULT_PAGE, Math.floor(params?.page ?? DEFAULT_PAGE));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(params?.limit ?? DEFAULT_LIMIT)));
  return { page, limit };
}

/**
 * Pagina un array de elementos en memoria.
 * Aplica los parámetros de paginación y retorna una respuesta paginada completa.
 *
 * @typeParam T - Tipo de los elementos a paginar.
 * @param items - Array completo de elementos.
 * @param params - Parámetros de paginación (page, limit).
 * @returns Respuesta paginada con los elementos de la página solicitada.
 *
 * @example
 * ```ts
 * const productos = [prod1, prod2, prod3, /* ... *\/];
 * const resultado = paginate(productos, { page: 2, limit: 10 });
 * // → { items: [...], total: 50, page: 2, limit: 10, hasMore: true }
 * ```
 */
export function paginate<T>(items: T[], params?: PaginationParams): PaginatedResponse<T> {
  const { page, limit } = normalizeParams(params);
  const total = items.length;
  const offset = (page - 1) * limit;

  // Si el offset excede el total, retornar página vacía.
  if (offset >= total && total > 0) {
    return {
      items: [],
      total,
      page,
      limit,
      hasMore: false,
    };
  }

  const paginatedItems = items.slice(offset, offset + limit);

  return {
    items: paginatedItems,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
}

/**
 * Construye información de paginación a partir de los datos disponibles.
 * Útil cuando los datos vienen de una API externa que solo provee el total.
 *
 * @param total - Cantidad total de elementos.
 * @param page - Página actual.
 * @param limit - Elementos por página.
 * @returns Información calculada de paginación.
 *
 * @example
 * ```ts
 * const info = buildPaginationInfo(150, 3, 20);
 * // → { hasMore: true, totalPages: 8, currentPage: 3 }
 * ```
 */
export function buildPaginationInfo(
  total: number,
  page: number,
  limit: number,
): PaginationInfo {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0;

  return {
    hasMore: safePage < totalPages,
    totalPages,
    currentPage: safePage,
  };
}

/**
 * Fusiona múltiples respuestas paginadas en una sola.
 * Útil para combinar resultados de múltiples proveedores en una vista unificada.
 *
 * Los totales se suman, los items se concatenan en orden, y la paginación
 * resultante refleja el conjunto combinado.
 *
 * @typeParam T - Tipo de los elementos.
 * @param results - Lista de respuestas paginadas a fusionar.
 * @returns Respuesta paginada combinada.
 *
 * @example
 * ```ts
 * const shopifyProducts = await shopify.listProducts({ page: 1, limit: 10 });
 * const wooProducts = await woo.listProducts({ page: 1, limit: 10 });
 * const combined = mergePaginatedResults([shopifyProducts, wooProducts]);
 * ```
 */
export function mergePaginatedResults<T>(
  results: PaginatedResponse<T>[],
): PaginatedResponse<T> {
  if (results.length === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      limit: DEFAULT_LIMIT,
      hasMore: false,
    };
  }

  const allItems: T[] = [];
  let totalCount = 0;
  let anyHasMore = false;

  for (const result of results) {
    allItems.push(...result.items);
    totalCount += result.total;
    if (result.hasMore) {
      anyHasMore = true;
    }
  }

  // Usar la página y limit del primer resultado como referencia.
  const firstResult = results[0]!;

  return {
    items: allItems,
    total: totalCount,
    page: firstResult.page,
    limit: firstResult.limit,
    hasMore: anyHasMore,
  };
}
