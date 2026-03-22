/**
 * @module order
 * @description Tipos relacionados con órdenes de compra, líneas de pedido,
 * direcciones, fulfillment y reembolsos en CommerceHub MCP Server.
 */

import type { DateRange, Money, PaginationParams, ProviderName, SortDirection } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Enums y tipos de estado
// ─────────────────────────────────────────────────────────────────────────────

/** Estado general de una orden. */
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/** Estado financiero de una orden. */
export type FinancialStatus =
  | 'pending'
  | 'paid'
  | 'partially_refunded'
  | 'refunded';

/** Estado de cumplimiento (fulfillment) de una orden. */
export type FulfillmentStatus =
  | 'unfulfilled'
  | 'partial'
  | 'fulfilled';

// ─────────────────────────────────────────────────────────────────────────────
// Dirección
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dirección postal normalizada.
 * Utilizada tanto para envío como para facturación.
 */
export interface Address {
  /** Nombre del destinatario. */
  firstName: string;
  /** Apellido del destinatario. */
  lastName: string;
  /** Nombre de la empresa o razón social (opcional). */
  company?: string;
  /** Línea principal de dirección (calle y número). */
  address1: string;
  /** Línea secundaria (departamento, piso, etc.). */
  address2?: string;
  /** Ciudad o localidad. */
  city: string;
  /** Provincia, estado o región. */
  province?: string;
  /** Código ISO de la provincia o estado. */
  provinceCode?: string;
  /** País. */
  country: string;
  /** Código ISO 3166-1 alpha-2 del país (ej. 'US', 'AR', 'MX'). */
  countryCode: string;
  /** Código postal / ZIP. */
  zip: string;
  /** Teléfono de contacto. */
  phone?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cliente de orden
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Datos del cliente asociado a una orden.
 * Subconjunto liviano de la entidad Customer completa.
 */
export interface OrderCustomer {
  /** Identificador del cliente. */
  id: string;
  /** Correo electrónico del cliente. */
  email: string;
  /** Nombre del cliente. */
  firstName: string;
  /** Apellido del cliente. */
  lastName: string;
  /** Teléfono de contacto. */
  phone?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Línea de pedido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Línea individual dentro de una orden.
 * Representa un producto/variante específico con su cantidad y precio.
 */
export interface LineItem {
  /** Identificador interno de la línea. */
  id: string;
  /** Identificador del producto asociado. */
  productId: string;
  /** Identificador de la variante asociada. */
  variantId?: string;
  /** Título del producto al momento de la compra. */
  title: string;
  /** SKU del producto/variante. */
  sku?: string;
  /** Cantidad solicitada. */
  quantity: number;
  /** Precio unitario (sin descuentos). */
  price: Money;
  /** Descuento total aplicado a esta línea. */
  totalDiscount: Money;
  /** Impuesto calculado para esta línea. */
  tax: Money;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orden
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orden de compra unificada.
 * Normaliza la representación de pedidos entre todos los proveedores soportados.
 *
 * @example
 * ```ts
 * const orden: Order = {
 *   id: 'ord_001',
 *   externalId: '5001',
 *   provider: 'shopify',
 *   orderNumber: '#1001',
 *   status: 'processing',
 *   financialStatus: 'paid',
 *   fulfillmentStatus: 'unfulfilled',
 *   customer: { id: 'cust_01', email: 'cliente@mail.com', firstName: 'Juan', lastName: 'Pérez' },
 *   lineItems: [],
 *   subtotal: { amount: 100, currency: 'USD' },
 *   shippingTotal: { amount: 10, currency: 'USD' },
 *   taxTotal: { amount: 15, currency: 'USD' },
 *   discountTotal: { amount: 0, currency: 'USD' },
 *   total: { amount: 125, currency: 'USD' },
 *   currency: 'USD',
 *   tags: [],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface Order {
  /** Identificador interno unificado de la orden. */
  id: string;
  /** Identificador de la orden en el proveedor externo. */
  externalId: string;
  /** Proveedor de origen de la orden. */
  provider: ProviderName;
  /** Número de orden visible para el cliente (ej. '#1001'). */
  orderNumber: string;
  /** Estado general de la orden. */
  status: OrderStatus;
  /** Estado financiero de la orden. */
  financialStatus: FinancialStatus;
  /** Estado de cumplimiento de la orden. */
  fulfillmentStatus: FulfillmentStatus;
  /** Datos del cliente que realizó la orden. */
  customer: OrderCustomer;
  /** Líneas de pedido (productos comprados). */
  lineItems: LineItem[];
  /** Dirección de envío. */
  shippingAddress?: Address;
  /** Dirección de facturación. */
  billingAddress?: Address;
  /** Subtotal antes de envío, impuestos y descuentos. */
  subtotal: Money;
  /** Costo total de envío. */
  shippingTotal: Money;
  /** Total de impuestos. */
  taxTotal: Money;
  /** Total de descuentos aplicados. */
  discountTotal: Money;
  /** Total final de la orden. */
  total: Money;
  /** Código de divisa de la orden (ISO 4217). */
  currency: string;
  /** Nota del cliente o interna. */
  note?: string;
  /** Etiquetas para clasificación y flujos de trabajo. */
  tags: string[];
  /** Fecha de creación de la orden. */
  createdAt: Date;
  /** Fecha de última actualización. */
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fulfillment (cumplimiento de envío)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Datos requeridos para registrar el cumplimiento (fulfillment) de una orden.
 */
export interface FulfillmentInput {
  /** Identificador de la orden a cumplir. */
  orderId: string;
  /** Número de seguimiento del envío. */
  trackingNumber?: string;
  /** Empresa de transporte (ej. 'FedEx', 'DHL', 'Correo Argentino'). */
  trackingCompany?: string;
  /** URL de seguimiento del envío. */
  trackingUrl?: string;
  /**
   * Líneas específicas a cumplir (fulfillment parcial).
   * Si no se proporcionan, se cumplen todas las líneas pendientes.
   */
  lineItems?: Array<{
    /** Identificador de la línea de pedido. */
    id: string;
    /** Cantidad a cumplir de esta línea. */
    quantity: number;
  }>;
  /** Indica si se debe notificar al cliente por correo electrónico. */
  notifyCustomer: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reembolso
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Datos requeridos para procesar un reembolso.
 */
export interface RefundInput {
  /** Identificador de la orden a reembolsar. */
  orderId: string;
  /** Monto total a reembolsar (si no se especifica, se calcula de las líneas). */
  amount?: Money;
  /**
   * Líneas específicas a reembolsar.
   * Permite reembolsos parciales por producto.
   */
  lineItems: Array<{
    /** Identificador de la línea de pedido. */
    id: string;
    /** Cantidad a reembolsar. */
    quantity: number;
  }>;
  /** Motivo del reembolso. */
  reason: string;
  /** Nota interna adicional sobre el reembolso. */
  note?: string;
  /** Indica si se debe reponer el inventario de los productos reembolsados. */
  restock: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros de órdenes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtros disponibles para listado y búsqueda de órdenes.
 */
export interface OrderFilters extends PaginationParams {
  /** Filtrar por estado general. */
  status?: OrderStatus;
  /** Filtrar por estado financiero. */
  financialStatus?: FinancialStatus;
  /** Filtrar por estado de cumplimiento. */
  fulfillmentStatus?: FulfillmentStatus;
  /** Filtrar por rango de fechas de creación. */
  dateRange?: DateRange;
  /** Filtrar por correo electrónico del cliente. */
  customerEmail?: string;
  /** Total mínimo de la orden. */
  minTotal?: number;
  /** Total máximo de la orden. */
  maxTotal?: number;
  /** Campo por el cual ordenar. */
  sortBy?: 'orderNumber' | 'total' | 'createdAt' | 'updatedAt';
  /** Dirección de ordenamiento. */
  sortDirection?: SortDirection;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notas y timeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nota asociada a una orden.
 * Puede ser visible solo para el equipo o también para el cliente.
 */
export interface OrderNote {
  /** Identificador de la nota. */
  id: string;
  /** Contenido de la nota. */
  body: string;
  /** Autor de la nota (nombre de usuario o sistema). */
  author: string;
  /** Fecha de creación de la nota. */
  createdAt: Date;
}

/**
 * Evento en la línea de tiempo de una orden.
 * Registra cambios de estado, pagos, envíos y otras acciones relevantes.
 */
export interface OrderTimelineEvent {
  /** Identificador del evento. */
  id: string;
  /** Tipo de evento (ej. 'status_change', 'payment', 'fulfillment', 'refund', 'note'). */
  type: string;
  /** Descripción legible del evento. */
  message: string;
  /** Fecha y hora en que ocurrió el evento. */
  createdAt: Date;
  /** Detalles adicionales específicos del tipo de evento. */
  details?: Record<string, unknown>;
}
