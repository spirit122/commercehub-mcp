/**
 * @module customer
 * @description Tipos relacionados con clientes, segmentación, filtros
 * y análisis de valor de vida del cliente (CLV) en CommerceHub MCP Server.
 */

import type { Money, PaginationParams, ProviderName, SortDirection } from './common.js';
import type { Address } from './order.js';

// ─────────────────────────────────────────────────────────────────────────────
// Segmentación de clientes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Segmentos de cliente basados en comportamiento de compra.
 * Utiliza el modelo RFM (Recency, Frequency, Monetary) simplificado.
 */
export enum CustomerSegment {
  /** Cliente de alto valor: compras frecuentes y montos elevados. */
  VIP = 'VIP',
  /** Cliente con patrones de compra estándar. */
  REGULAR = 'REGULAR',
  /** Cliente reciente, aún sin historial significativo. */
  NEW = 'NEW',
  /** Cliente que muestra señales de abandono (compras en declive). */
  AT_RISK = 'AT_RISK',
  /** Cliente inactivo por período prolongado. */
  LOST = 'LOST',
  /** Cliente excepcional: máxima frecuencia y recencia de compra. */
  CHAMPION = 'CHAMPION',
}

// ─────────────────────────────────────────────────────────────────────────────
// Cliente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cliente unificado de comercio electrónico.
 * Normaliza datos de clientes entre todos los proveedores soportados,
 * incluyendo métricas agregadas de comportamiento de compra.
 *
 * @example
 * ```ts
 * const cliente: Customer = {
 *   id: 'cust_001',
 *   externalId: '98765',
 *   provider: 'shopify',
 *   email: 'maria@example.com',
 *   firstName: 'María',
 *   lastName: 'García',
 *   totalOrders: 15,
 *   totalSpent: { amount: 2500, currency: 'USD' },
 *   averageOrderValue: { amount: 166.67, currency: 'USD' },
 *   tags: ['premium', 'newsletter'],
 *   addresses: [],
 *   acceptsMarketing: true,
 *   segment: CustomerSegment.VIP,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface Customer {
  /** Identificador interno unificado del cliente. */
  id: string;
  /** Identificador del cliente en el proveedor externo. */
  externalId: string;
  /** Proveedor de origen del registro del cliente. */
  provider: ProviderName;
  /** Correo electrónico del cliente. */
  email: string;
  /** Nombre del cliente. */
  firstName: string;
  /** Apellido del cliente. */
  lastName: string;
  /** Teléfono de contacto. */
  phone?: string;
  /** Nombre de la empresa o razón social. */
  company?: string;
  /** Cantidad total de órdenes realizadas. */
  totalOrders: number;
  /** Monto total gastado por el cliente a lo largo de su historia. */
  totalSpent: Money;
  /** Valor promedio por orden. */
  averageOrderValue: Money;
  /** Etiquetas de clasificación del cliente. */
  tags: string[];
  /** Direcciones registradas del cliente. */
  addresses: Address[];
  /** Indica si el cliente acepta comunicaciones de marketing. */
  acceptsMarketing: boolean;
  /** Segmento calculado del cliente según comportamiento de compra. */
  segment: CustomerSegment;
  /** Fecha de la primera orden del cliente. */
  firstOrderAt?: Date;
  /** Fecha de la última orden del cliente. */
  lastOrderAt?: Date;
  /** Fecha de registro del cliente. */
  createdAt: Date;
  /** Fecha de última actualización del registro. */
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros de clientes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtros disponibles para listado y búsqueda de clientes.
 */
export interface CustomerFilters extends PaginationParams {
  /** Filtrar por segmento de cliente. */
  segment?: CustomerSegment;
  /** Búsqueda de texto libre (nombre, email, teléfono). */
  query?: string;
  /** Cantidad mínima de órdenes realizadas. */
  minOrders?: number;
  /** Monto mínimo gastado (en la divisa por defecto de la tienda). */
  minSpent?: number;
  /** Solo clientes cuya última orden fue antes de esta fecha. */
  lastOrderBefore?: Date;
  /** Solo clientes cuya última orden fue después de esta fecha. */
  lastOrderAfter?: Date;
  /** Filtrar por preferencia de marketing. */
  acceptsMarketing?: boolean;
  /** Campo por el cual ordenar. */
  sortBy?: 'totalSpent' | 'totalOrders' | 'lastOrderAt' | 'createdAt';
  /** Dirección de ordenamiento. */
  sortDirection?: SortDirection;
}

// ─────────────────────────────────────────────────────────────────────────────
// Valor de vida del cliente (CLV)
// ─────────────────────────────────────────────────────────────────────────────

/** Nivel de riesgo de abandono (churn) de un cliente. */
export type ChurnRiskLevel = 'low' | 'medium' | 'high';

/**
 * Análisis del valor de vida del cliente (Customer Lifetime Value).
 * Combina métricas históricas con predicciones de comportamiento futuro.
 *
 * @example
 * ```ts
 * const clv: CustomerLifetimeValue = {
 *   customerId: 'cust_001',
 *   totalRevenue: { amount: 2500, currency: 'USD' },
 *   totalOrders: 15,
 *   avgOrderValue: { amount: 166.67, currency: 'USD' },
 *   predictedNextOrder: new Date('2026-04-15'),
 *   churnRisk: 'low',
 *   daysSinceLastOrder: 12,
 *   purchaseFrequencyDays: 21,
 * };
 * ```
 */
export interface CustomerLifetimeValue {
  /** Identificador del cliente analizado. */
  customerId: string;
  /** Ingresos totales generados por el cliente. */
  totalRevenue: Money;
  /** Cantidad total de órdenes completadas. */
  totalOrders: number;
  /** Valor promedio por orden. */
  avgOrderValue: Money;
  /** Fecha estimada de la próxima compra (basada en frecuencia histórica). */
  predictedNextOrder?: Date;
  /** Nivel de riesgo de abandono del cliente. */
  churnRisk: ChurnRiskLevel;
  /** Días transcurridos desde la última orden. */
  daysSinceLastOrder: number;
  /** Frecuencia promedio de compra en días. */
  purchaseFrequencyDays: number;
}
