/**
 * @module inventory
 * @description Tipos relacionados con inventario, movimientos de stock,
 * alertas de bajo inventario y pronósticos de reabastecimiento
 * en CommerceHub MCP Server.
 */

import type { Money, PaginationParams, ProviderName } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Enums y tipos auxiliares
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Motivo de un ajuste de inventario.
 * Permite trazabilidad completa de cada cambio en el stock.
 */
export type InventoryUpdateReason =
  | 'received'    // Mercadería recibida de proveedor
  | 'sold'        // Venta realizada
  | 'returned'    // Devolución de cliente
  | 'adjustment'  // Ajuste por conteo físico
  | 'damaged'     // Mercadería dañada / merma
  | 'manual';     // Ajuste manual sin categoría específica

// ─────────────────────────────────────────────────────────────────────────────
// Ítem de inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registro de inventario para un producto/variante específico.
 * Representa el estado actual del stock en una ubicación dada.
 *
 * @example
 * ```ts
 * const item: InventoryItem = {
 *   id: 'inv_001',
 *   externalId: '7890',
 *   provider: 'shopify',
 *   sku: 'CAM-AZU-M',
 *   productId: 'prod_001',
 *   productTitle: 'Camiseta Azul',
 *   variantTitle: 'M',
 *   quantity: 50,
 *   reserved: 5,
 *   available: 45,
 *   location: 'Depósito Central',
 *   reorderPoint: 10,
 *   costPerItem: { amount: 8.5, currency: 'USD' },
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface InventoryItem {
  /** Identificador interno del registro de inventario. */
  id: string;
  /** Identificador del ítem de inventario en el proveedor externo. */
  externalId?: string;
  /** Proveedor de origen. */
  provider: ProviderName;
  /** Código SKU del producto/variante. */
  sku: string;
  /** Identificador del producto asociado. */
  productId: string;
  /** Título del producto. */
  productTitle: string;
  /** Título de la variante (ej. 'Azul / M'). */
  variantTitle?: string;
  /** Cantidad total en stock (incluye reservados). */
  quantity: number;
  /** Cantidad reservada (asignada a órdenes pendientes de fulfillment). */
  reserved: number;
  /** Cantidad disponible para venta (quantity - reserved). */
  available: number;
  /** Ubicación o almacén donde se encuentra el stock. */
  location?: string;
  /** Punto de reorden: cantidad mínima que dispara alerta de reabastecimiento. */
  reorderPoint?: number;
  /** Costo unitario por ítem (para cálculos de margen). */
  costPerItem?: Money;
  /** Fecha de última actualización del inventario. */
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualización de inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Datos para realizar una actualización de inventario.
 * Identifica el producto por SKU o por ID de producto.
 */
export interface InventoryUpdate {
  /** Código SKU del producto/variante (alternativa a productId). */
  sku?: string;
  /** Identificador del producto (alternativa a sku). */
  productId?: string;
  /** Nueva cantidad o cantidad a ajustar (según implementación del proveedor). */
  quantity: number;
  /** Motivo del ajuste de inventario. */
  reason: InventoryUpdateReason;
  /** Ubicación específica del ajuste (si aplica multi-ubicación). */
  location?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Movimiento de inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registro histórico de un movimiento de inventario.
 * Proporciona trazabilidad completa de cada cambio en el stock.
 */
export interface InventoryMovement {
  /** Identificador del movimiento. */
  id: string;
  /** Código SKU del producto/variante afectado. */
  sku: string;
  /** Cantidad antes del movimiento. */
  previousQuantity: number;
  /** Cantidad después del movimiento. */
  newQuantity: number;
  /** Diferencia (positiva = entrada, negativa = salida). */
  change: number;
  /** Motivo del movimiento. */
  reason: InventoryUpdateReason;
  /** Fecha y hora del movimiento. */
  createdAt: Date;
  /** Usuario o sistema que realizó el movimiento. */
  createdBy?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alertas de bajo stock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ítem de inventario con stock bajo, extendido con métricas predictivas.
 * Utilizado para alertas proactivas de reabastecimiento.
 */
export interface LowStockItem extends InventoryItem {
  /** Días estimados hasta el agotamiento de stock (basado en velocidad de ventas). */
  daysUntilStockout: number;
  /** Promedio de ventas diarias de este ítem. */
  averageDailySales: number;
  /** Cantidad sugerida de reorden para cubrir el ciclo de reabastecimiento. */
  suggestedReorderQuantity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pronóstico de inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pronóstico de inventario para un producto/variante específico.
 * Combina datos históricos de ventas con proyecciones futuras.
 *
 * @example
 * ```ts
 * const forecast: InventoryForecast = {
 *   sku: 'CAM-AZU-M',
 *   currentQuantity: 45,
 *   averageDailySales: 3.2,
 *   projectedStockoutDate: new Date('2026-04-05'),
 *   daysUntilStockout: 14,
 *   suggestedReorderDate: new Date('2026-03-29'),
 *   suggestedReorderQuantity: 100,
 * };
 * ```
 */
export interface InventoryForecast {
  /** Código SKU del producto/variante. */
  sku: string;
  /** Cantidad actual en stock. */
  currentQuantity: number;
  /** Promedio de ventas diarias (calculado sobre los últimos 30 días). */
  averageDailySales: number;
  /** Fecha proyectada de agotamiento de stock. */
  projectedStockoutDate: Date;
  /** Días restantes hasta el agotamiento de stock. */
  daysUntilStockout: number;
  /** Fecha sugerida para realizar el pedido de reabastecimiento. */
  suggestedReorderDate: Date;
  /** Cantidad sugerida a reordenar. */
  suggestedReorderQuantity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros de inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtros disponibles para consultas de inventario.
 */
export interface InventoryFilters extends PaginationParams {
  /** Filtrar por ubicación o almacén. */
  location?: string;
  /** Solo mostrar ítems por debajo del punto de reorden. */
  belowReorderPoint?: boolean;
  /** Filtrar por código SKU específico. */
  sku?: string;
  /** Filtrar por identificador de producto. */
  productId?: string;
  /** Cantidad mínima disponible. */
  minAvailable?: number;
  /** Cantidad máxima disponible. */
  maxAvailable?: number;
}
