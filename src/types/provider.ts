/**
 * @module provider
 * @description Interface unificada del proveedor de comercio electrónico
 * y su configuración. Todos los proveedores (Shopify, WooCommerce, Stripe,
 * MercadoLibre) deben implementar esta interface para integrarse con
 * CommerceHub MCP Server.
 */

import type {
  DateRange,
  OperationResult,
  PaginatedResponse,
  PaginationParams,
  ProviderName,
} from './common.js';
import type {
  CreateProductInput,
  Product,
  ProductFilters,
  UpdateProductInput,
} from './product.js';
import type {
  FulfillmentInput,
  Order,
  OrderFilters,
  OrderNote,
  OrderTimelineEvent,
  RefundInput,
} from './order.js';
import type {
  InventoryFilters,
  InventoryItem,
  InventoryMovement,
  InventoryUpdate,
} from './inventory.js';
import type { Customer, CustomerFilters } from './customer.js';
import type { ConversionFunnel, RevenueReport, TopProduct } from './analytics.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración del proveedor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración de conexión para un proveedor de comercio electrónico.
 * Todos los campos son opcionales ya que cada proveedor requiere un
 * subconjunto diferente de credenciales.
 *
 * @example
 * ```ts
 * // Configuración para Shopify
 * const shopifyConfig: ProviderConfig = {
 *   storeUrl: 'mi-tienda.myshopify.com',
 *   accessToken: 'shpat_xxxxxxxxxxxx',
 *   apiVersion: '2024-01',
 * };
 *
 * // Configuración para WooCommerce
 * const wooConfig: ProviderConfig = {
 *   storeUrl: 'https://mi-tienda.com',
 *   apiKey: 'ck_xxxxxxxxxxxx',
 *   apiSecret: 'cs_xxxxxxxxxxxx',
 * };
 *
 * // Configuración para Stripe
 * const stripeConfig: ProviderConfig = {
 *   apiKey: 'sk_live_xxxxxxxxxxxx',
 *   webhookSecret: 'whsec_xxxxxxxxxxxx',
 * };
 *
 * // Configuración para MercadoLibre
 * const mlConfig: ProviderConfig = {
 *   accessToken: 'APP_USR-xxxxxxxxxxxx',
 *   refreshToken: 'TG-xxxxxxxxxxxx',
 *   clientId: '1234567890',
 *   clientSecret: 'xxxxxxxxxxxx',
 * };
 * ```
 */
export interface ProviderConfig {
  /** Clave API principal del proveedor. */
  apiKey?: string;
  /** Secreto API (usado en combinación con apiKey). */
  apiSecret?: string;
  /** URL de la tienda (dominio Shopify, URL base WooCommerce, etc.). */
  storeUrl?: string;
  /** Token de acceso OAuth o de API privada. */
  accessToken?: string;
  /** Token de actualización (para flujos OAuth con renovación). */
  refreshToken?: string;
  /** Identificador de la aplicación o cliente OAuth. */
  clientId?: string;
  /** Secreto del cliente OAuth. */
  clientSecret?: string;
  /** Secreto para validación de webhooks. */
  webhookSecret?: string;
  /** Versión de la API a utilizar (ej. '2024-01' para Shopify). */
  apiVersion?: string;
  /** Tiempo máximo de espera por solicitud en milisegundos. */
  timeout?: number;
  /** Cantidad máxima de reintentos automáticos ante errores transitorios. */
  maxRetries?: number;
  /** Configuración adicional específica del proveedor. */
  extra?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface del proveedor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface unificada que deben implementar todos los proveedores de comercio
 * electrónico. Define el contrato completo para operaciones de productos,
 * órdenes, inventario, clientes y analytics.
 *
 * @example
 * ```ts
 * class ShopifyProvider implements ICommerceProvider {
 *   name: ProviderName = 'shopify';
 *   // ... implementar todos los métodos
 * }
 * ```
 */
export interface ICommerceProvider {
  // ──────────────────────── Identidad ────────────────────────

  /** Nombre identificador del proveedor. */
  readonly name: ProviderName;

  // ──────────────────────── Ciclo de vida ────────────────────────

  /**
   * Inicializa la conexión con el proveedor usando la configuración proporcionada.
   * Debe validar las credenciales y establecer cualquier estado necesario.
   *
   * @param config - Configuración de conexión del proveedor.
   * @throws {CommerceHubError} Si la configuración es inválida o la conexión falla.
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Verifica si el proveedor ha sido configurado e inicializado correctamente.
   *
   * @returns `true` si el proveedor está listo para recibir solicitudes.
   */
  isConfigured(): boolean;

  // ──────────────────────── Productos ────────────────────────

  /**
   * Lista productos del proveedor con paginación y filtros.
   *
   * @param filters - Filtros y parámetros de paginación.
   * @returns Lista paginada de productos.
   */
  listProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product>>;

  /**
   * Obtiene un producto por su identificador.
   *
   * @param productId - Identificador del producto.
   * @returns El producto encontrado.
   * @throws {CommerceHubError} Con código NOT_FOUND si no existe.
   */
  getProduct(productId: string): Promise<Product>;

  /**
   * Crea un nuevo producto en el proveedor.
   *
   * @param input - Datos del producto a crear.
   * @returns El producto creado con sus identificadores asignados.
   */
  createProduct(input: CreateProductInput): Promise<Product>;

  /**
   * Actualiza un producto existente en el proveedor.
   *
   * @param productId - Identificador del producto a actualizar.
   * @param input - Campos a actualizar.
   * @returns El producto actualizado.
   * @throws {CommerceHubError} Con código NOT_FOUND si no existe.
   */
  updateProduct(productId: string, input: UpdateProductInput): Promise<Product>;

  /**
   * Elimina un producto del proveedor.
   *
   * @param productId - Identificador del producto a eliminar.
   * @returns Resultado de la operación.
   */
  deleteProduct(productId: string): Promise<OperationResult<void>>;

  /**
   * Busca productos por texto libre.
   *
   * @param query - Texto de búsqueda.
   * @param pagination - Parámetros de paginación.
   * @returns Lista paginada de productos que coinciden con la búsqueda.
   */
  searchProducts(query: string, pagination?: PaginationParams): Promise<PaginatedResponse<Product>>;

  // ──────────────────────── Órdenes ────────────────────────

  /**
   * Lista órdenes del proveedor con paginación y filtros.
   *
   * @param filters - Filtros y parámetros de paginación.
   * @returns Lista paginada de órdenes.
   */
  listOrders(filters?: OrderFilters): Promise<PaginatedResponse<Order>>;

  /**
   * Obtiene una orden por su identificador.
   *
   * @param orderId - Identificador de la orden.
   * @returns La orden encontrada.
   * @throws {CommerceHubError} Con código NOT_FOUND si no existe.
   */
  getOrder(orderId: string): Promise<Order>;

  /**
   * Crea una nueva orden en el proveedor.
   *
   * @param order - Datos de la orden a crear.
   * @returns La orden creada con sus identificadores asignados.
   */
  createOrder(order: Partial<Order>): Promise<Order>;

  /**
   * Registra el cumplimiento (fulfillment) de una orden.
   *
   * @param input - Datos de fulfillment (tracking, líneas, notificación).
   * @returns La orden actualizada.
   */
  fulfillOrder(input: FulfillmentInput): Promise<Order>;

  /**
   * Cancela una orden existente.
   *
   * @param orderId - Identificador de la orden a cancelar.
   * @param reason - Motivo de la cancelación.
   * @returns La orden cancelada.
   */
  cancelOrder(orderId: string, reason?: string): Promise<Order>;

  /**
   * Procesa un reembolso sobre una orden.
   *
   * @param input - Datos del reembolso (monto, líneas, motivo).
   * @returns La orden actualizada tras el reembolso.
   */
  refundOrder(input: RefundInput): Promise<Order>;

  /**
   * Agrega una nota a una orden.
   *
   * @param orderId - Identificador de la orden.
   * @param note - Contenido de la nota.
   * @returns La nota creada.
   */
  addOrderNote(orderId: string, note: string): Promise<OrderNote>;

  /**
   * Obtiene la línea de tiempo (timeline) de eventos de una orden.
   *
   * @param orderId - Identificador de la orden.
   * @returns Lista de eventos ordenados cronológicamente.
   */
  getOrderTimeline(orderId: string): Promise<OrderTimelineEvent[]>;

  // ──────────────────────── Inventario ────────────────────────

  /**
   * Obtiene el inventario del proveedor con filtros opcionales.
   *
   * @param filters - Filtros de inventario.
   * @returns Lista paginada de ítems de inventario.
   */
  getInventory(filters?: InventoryFilters): Promise<PaginatedResponse<InventoryItem>>;

  /**
   * Actualiza el inventario de un producto/variante individual.
   *
   * @param update - Datos de la actualización.
   * @returns El ítem de inventario actualizado.
   */
  updateInventory(update: InventoryUpdate): Promise<InventoryItem>;

  /**
   * Actualiza el inventario de múltiples productos/variantes en lote.
   *
   * @param updates - Lista de actualizaciones a aplicar.
   * @returns Resultado por cada actualización (éxito o error individual).
   */
  bulkUpdateInventory(updates: InventoryUpdate[]): Promise<OperationResult<InventoryItem>[]>;

  /**
   * Obtiene el historial de movimientos de inventario de un SKU.
   *
   * @param sku - Código SKU del producto/variante.
   * @param dateRange - Rango de fechas opcional para filtrar el historial.
   * @returns Lista de movimientos ordenados cronológicamente (más reciente primero).
   */
  getInventoryHistory(sku: string, dateRange?: DateRange): Promise<InventoryMovement[]>;

  // ──────────────────────── Clientes ────────────────────────

  /**
   * Lista clientes del proveedor con paginación y filtros.
   *
   * @param filters - Filtros y parámetros de paginación.
   * @returns Lista paginada de clientes.
   */
  listCustomers(filters?: CustomerFilters): Promise<PaginatedResponse<Customer>>;

  /**
   * Obtiene un cliente por su identificador.
   *
   * @param customerId - Identificador del cliente.
   * @returns El cliente encontrado.
   * @throws {CommerceHubError} Con código NOT_FOUND si no existe.
   */
  getCustomer(customerId: string): Promise<Customer>;

  /**
   * Busca clientes por texto libre.
   *
   * @param query - Texto de búsqueda (nombre, email, teléfono).
   * @param pagination - Parámetros de paginación.
   * @returns Lista paginada de clientes que coinciden.
   */
  searchCustomers(query: string, pagination?: PaginationParams): Promise<PaginatedResponse<Customer>>;

  /**
   * Obtiene las órdenes de un cliente específico.
   *
   * @param customerId - Identificador del cliente.
   * @param pagination - Parámetros de paginación.
   * @returns Lista paginada de órdenes del cliente.
   */
  getCustomerOrders(customerId: string, pagination?: PaginationParams): Promise<PaginatedResponse<Order>>;

  // ──────────────────────── Analytics ────────────────────────

  /**
   * Obtiene el reporte de ingresos para un período.
   *
   * @param dateRange - Período del reporte.
   * @returns Reporte de ingresos completo con comparación y desglose.
   */
  getRevenue(dateRange: DateRange): Promise<RevenueReport>;

  /**
   * Obtiene los productos más vendidos en un período.
   *
   * @param dateRange - Período de consulta.
   * @param limit - Cantidad máxima de productos a retornar (por defecto: 10).
   * @returns Lista de productos más vendidos, ordenados por ingresos.
   */
  getTopProducts(dateRange: DateRange, limit?: number): Promise<TopProduct[]>;

  /**
   * Obtiene las métricas del embudo de conversión para un período.
   *
   * @param dateRange - Período de consulta.
   * @returns Métricas del embudo de conversión.
   */
  getConversionFunnel(dateRange: DateRange): Promise<ConversionFunnel>;
}
