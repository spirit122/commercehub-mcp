/**
 * @module analytics
 * @description Tipos relacionados con reportes de ingresos, análisis de ventas,
 * pronósticos, embudos de conversión y dashboards en CommerceHub MCP Server.
 */

import type { DateRange, Money, ProviderName } from './common.js';
import type { Order } from './order.js';
import type { LowStockItem } from './inventory.js';

// ─────────────────────────────────────────────────────────────────────────────
// Ingresos diarios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Desglose de ingresos para un día específico.
 */
export interface DailyRevenue {
  /** Fecha del día (formato ISO 8601, solo fecha). */
  date: string;
  /** Ingresos brutos del día. */
  revenue: Money;
  /** Cantidad de órdenes del día. */
  orders: number;
  /** Valor promedio por orden del día. */
  averageOrderValue: Money;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporte de ingresos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reporte completo de ingresos para un período determinado.
 * Incluye comparación con el período anterior y desglose diario.
 *
 * @example
 * ```ts
 * const reporte: RevenueReport = {
 *   period: { from: new Date('2026-03-01'), to: new Date('2026-03-31') },
 *   revenue: { amount: 45000, currency: 'USD' },
 *   previousPeriodRevenue: { amount: 38000, currency: 'USD' },
 *   changePercent: 18.42,
 *   orderCount: 320,
 *   averageOrderValue: { amount: 140.63, currency: 'USD' },
 *   refundTotal: { amount: 1200, currency: 'USD' },
 *   netRevenue: { amount: 43800, currency: 'USD' },
 *   dailyBreakdown: [],
 * };
 * ```
 */
export interface RevenueReport {
  /** Período cubierto por el reporte. */
  period: DateRange;
  /** Ingresos brutos totales del período. */
  revenue: Money;
  /** Ingresos brutos del período anterior (para comparación). */
  previousPeriodRevenue?: Money;
  /** Porcentaje de cambio respecto al período anterior (-100 a +Infinity). */
  changePercent?: number;
  /** Cantidad total de órdenes en el período. */
  orderCount: number;
  /** Valor promedio por orden en el período. */
  averageOrderValue: Money;
  /** Total de reembolsos emitidos en el período. */
  refundTotal: Money;
  /** Ingresos netos (revenue - refundTotal). */
  netRevenue: Money;
  /** Desglose día a día dentro del período. */
  dailyBreakdown: DailyRevenue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Productos más vendidos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Producto destacado por volumen de ventas o ingresos generados.
 */
export interface TopProduct {
  /** Identificador del producto. */
  productId: string;
  /** Título del producto. */
  title: string;
  /** Código SKU principal del producto. */
  sku?: string;
  /** Cantidad total de unidades vendidas en el período. */
  quantitySold: number;
  /** Ingresos totales generados por este producto. */
  revenue: Money;
  /** URL de la imagen principal del producto. */
  imageUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ventas por canal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Desglose de ventas por canal / proveedor de comercio electrónico.
 * Permite comparar rendimiento entre tiendas (Shopify vs WooCommerce, etc.).
 */
export interface ChannelSales {
  /** Proveedor / canal de ventas. */
  provider: ProviderName;
  /** Ingresos totales del canal en el período. */
  revenue: Money;
  /** Cantidad de órdenes del canal. */
  orders: number;
  /** Valor promedio por orden del canal. */
  averageOrderValue: Money;
  /** Productos más vendidos en este canal. */
  topProducts: TopProduct[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Embudo de conversión
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Métricas del embudo de conversión de la tienda.
 * Permite identificar dónde se pierden los visitantes en el proceso de compra.
 *
 * @example
 * ```ts
 * const funnel: ConversionFunnel = {
 *   visitors: 10000,
 *   addedToCart: 2500,
 *   initiatedCheckout: 1200,
 *   completed: 800,
 *   cartRate: 25.0,
 *   checkoutRate: 48.0,
 *   conversionRate: 8.0,
 * };
 * ```
 */
export interface ConversionFunnel {
  /** Visitantes únicos en el período. */
  visitors: number;
  /** Visitantes que agregaron al menos un producto al carrito. */
  addedToCart: number;
  /** Visitantes que iniciaron el proceso de checkout. */
  initiatedCheckout: number;
  /** Visitantes que completaron la compra. */
  completed: number;
  /** Tasa de agregado al carrito (addedToCart / visitors * 100). */
  cartRate: number;
  /** Tasa de inicio de checkout (initiatedCheckout / addedToCart * 100). */
  checkoutRate: number;
  /** Tasa de conversión total (completed / visitors * 100). */
  conversionRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pronóstico de ventas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pronóstico de ventas para un período futuro.
 * Generado mediante modelos de series temporales o heurísticas simples.
 */
export interface SalesForecast {
  /** Período proyectado. */
  period: DateRange;
  /** Ingresos proyectados para el período. */
  projectedRevenue: Money;
  /** Cantidad proyectada de órdenes. */
  projectedOrders: number;
  /** Nivel de confianza de la predicción (0.0 = nula, 1.0 = máxima). */
  confidence: number;
  /** Método utilizado para generar el pronóstico. */
  method: string;
  /** Factores considerados en la predicción. */
  factors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis de reembolsos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Análisis detallado de reembolsos en un período.
 * Permite identificar patrones y productos problemáticos.
 */
export interface RefundAnalysis {
  /** Período analizado. */
  period: DateRange;
  /** Monto total reembolsado en el período. */
  totalRefunds: Money;
  /** Cantidad de reembolsos procesados. */
  refundCount: number;
  /** Tasa de reembolso respecto al total de órdenes (porcentaje). */
  refundRate: number;
  /** Motivos de reembolso más frecuentes, ordenados por frecuencia. */
  topReasons: Array<{
    /** Motivo del reembolso. */
    reason: string;
    /** Cantidad de reembolsos con este motivo. */
    count: number;
    /** Porcentaje respecto al total de reembolsos. */
    percentage: number;
  }>;
  /** Desglose de reembolsos por producto. */
  byProduct: Array<{
    /** Identificador del producto. */
    productId: string;
    /** Título del producto. */
    title: string;
    /** Cantidad de reembolsos de este producto. */
    refundCount: number;
    /** Monto total reembolsado de este producto. */
    refundAmount: Money;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard resumen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resumen completo del dashboard de comercio electrónico.
 * Agrega las métricas más relevantes en una única consulta.
 */
export interface DashboardSummary {
  /** Reporte de ingresos del período actual. */
  revenue: RevenueReport;
  /** Productos más vendidos en el período. */
  topProducts: TopProduct[];
  /** Órdenes más recientes. */
  recentOrders: Order[];
  /** Ítems con stock bajo que requieren atención. */
  lowStockItems: LowStockItem[];
  /** Estadísticas generales de clientes. */
  customerStats: {
    /** Total de clientes registrados. */
    totalCustomers: number;
    /** Nuevos clientes en el período. */
    newCustomers: number;
    /** Clientes que realizaron compras repetidas en el período. */
    returningCustomers: number;
    /** Valor promedio de vida del cliente (CLV promedio). */
    averageLifetimeValue: Money;
  };
}
