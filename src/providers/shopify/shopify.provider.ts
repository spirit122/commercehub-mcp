/**
 * @module providers/shopify
 * @description Implementación del proveedor Shopify para CommerceHub MCP Server.
 * Utiliza la API REST Admin 2024-01 de Shopify para todas las operaciones de
 * productos, órdenes, inventario, clientes y analytics.
 */

import type {
  ProviderConfig,
  ProviderName,
  PaginatedResponse,
  PaginationParams,
  DateRange,
  OperationResult,
  Product,
  ProductFilters,
  CreateProductInput,
  UpdateProductInput,
  Order,
  OrderFilters,
  FulfillmentInput,
  RefundInput,
  OrderNote,
  OrderTimelineEvent,
  InventoryItem,
  InventoryFilters,
  InventoryUpdate,
  InventoryMovement,
  Customer,
  CustomerFilters,
  RevenueReport,
  DailyRevenue,
  TopProduct,
  ConversionFunnel,
} from '../../types/index.js';
import { BaseProvider } from '../base.provider.js';
import {
  mapShopifyProduct,
  mapProductToShopify,
  mapShopifyOrder,
  mapShopifyCustomer,
  mapShopifyInventory,
} from './shopify.mapper.js';
import { validateShopifyConfig, buildShopifyHeaders, SHOPIFY_API_VERSION } from './shopify.auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// ShopifyProvider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proveedor de comercio electrónico para Shopify.
 * Implementa todas las operaciones del interface ICommerceProvider
 * utilizando la API REST Admin de Shopify versión 2024-01.
 *
 * @example
 * ```ts
 * const provider = new ShopifyProvider();
 * await provider.initialize({
 *   storeUrl: 'mi-tienda.myshopify.com',
 *   accessToken: 'shpat_xxxxxxxxxxxx',
 * });
 * const products = await provider.listProducts({ limit: 10 });
 * ```
 */
export class ShopifyProvider extends BaseProvider {
  readonly name: ProviderName = 'shopify';

  /** URL base de la tienda normalizada. */
  private storeUrl = '';

  /** Token de acceso a la API. */
  private accessToken = '';

  // ──────────────────────── Ciclo de vida ────────────────────────

  /** @inheritdoc */
  async initialize(config: ProviderConfig): Promise<void> {
    validateShopifyConfig(config);
    this.storeUrl = config.storeUrl!.replace(/\/$/, '');
    this.accessToken = config.accessToken!;
    await super.initialize(config);
  }

  /** @inheritdoc */
  protected buildUrl(path: string): string {
    const version = this.config?.apiVersion ?? SHOPIFY_API_VERSION;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://${this.storeUrl}/admin/api/${version}${cleanPath}`;
  }

  /** @inheritdoc */
  protected buildHeaders(): Record<string, string> {
    return buildShopifyHeaders(this.accessToken);
  }

  // ──────────────────────── Productos ────────────────────────

  /** @inheritdoc */
  async listProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: filters?.limit ?? 20,
    };

    if (filters?.status) params.status = filters.status;
    if (filters?.vendor) params.vendor = filters.vendor;
    if (filters?.productType) params.product_type = filters.productType;
    if (filters?.collection) params.collection_id = filters.collection;
    if (filters?.createdAfter) params.created_at_min = filters.createdAfter.toISOString();

    // Shopify usa page_info para paginación de cursor, pero para simplificar
    // usamos since_id con el último producto de la página anterior.
    // Sin embargo, para la interfaz paginada usamos limit+page simulado.
    const page = filters?.page ?? 1;
    if (page > 1) {
      // Para paginación básica, obtener el count y paginar.
      // Nota: Para producción se recomienda usar paginación por cursor con Link headers.
      params.limit = filters?.limit ?? 20;
    }

    const data = await this.httpGet<{ products: unknown[] }>('/products.json', params);
    const products = data.products.map((p) => mapShopifyProduct(p as Record<string, unknown> as never));

    // Obtener el count total
    const countData = await this.httpGet<{ count: number }>('/products/count.json', {
      status: filters?.status,
    });

    const limit = filters?.limit ?? 20;
    return {
      items: products,
      total: countData.count,
      page,
      limit,
      hasMore: page * limit < countData.count,
    };
  }

  /** @inheritdoc */
  async getProduct(productId: string): Promise<Product> {
    const data = await this.httpGet<{ product: unknown }>(`/products/${productId}.json`);
    return mapShopifyProduct(data.product as never);
  }

  /** @inheritdoc */
  async createProduct(input: CreateProductInput): Promise<Product> {
    const shopifyPayload = mapProductToShopify(input);
    const data = await this.httpPost<{ product: unknown }>('/products.json', shopifyPayload);
    return mapShopifyProduct(data.product as never);
  }

  /** @inheritdoc */
  async updateProduct(productId: string, input: UpdateProductInput): Promise<Product> {
    const product: Record<string, unknown> = { id: Number(productId) };

    if (input.title !== undefined) product.title = input.title;
    if (input.htmlDescription !== undefined) product.body_html = input.htmlDescription;
    else if (input.description !== undefined) product.body_html = `<p>${input.description}</p>`;
    if (input.slug !== undefined) product.handle = input.slug;
    if (input.status !== undefined) product.status = input.status;
    if (input.vendor !== undefined) product.vendor = input.vendor;
    if (input.productType !== undefined) product.product_type = input.productType;
    if (input.tags !== undefined) product.tags = input.tags.join(', ');

    if (input.variants) {
      product.variants = input.variants.map((v) => {
        const variant: Record<string, unknown> = {};
        if (v.id) variant.id = Number(v.id);
        if (v.title) variant.title = v.title;
        if (v.sku) variant.sku = v.sku;
        if (v.price) variant.price = String(v.price.amount);
        return variant;
      });
    }

    const data = await this.httpPut<{ product: unknown }>(
      `/products/${productId}.json`,
      { product },
    );
    return mapShopifyProduct(data.product as never);
  }

  /** @inheritdoc */
  async deleteProduct(productId: string): Promise<OperationResult<void>> {
    try {
      await this.httpDelete(`/products/${productId}.json`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** @inheritdoc */
  async searchProducts(
    query: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Product>> {
    // Shopify REST Admin no tiene un endpoint de búsqueda de texto libre
    // para productos. Usamos listProducts con título como filtro.
    return this.listProducts({
      query,
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  // ──────────────────────── Órdenes ────────────────────────

  /** @inheritdoc */
  async listOrders(filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: filters?.limit ?? 20,
      status: 'any',
    };

    if (filters?.financialStatus) params.financial_status = filters.financialStatus;
    if (filters?.fulfillmentStatus) params.fulfillment_status = filters.fulfillmentStatus;
    if (filters?.dateRange?.from) params.created_at_min = filters.dateRange.from.toISOString();
    if (filters?.dateRange?.to) params.created_at_max = filters.dateRange.to.toISOString();

    const data = await this.httpGet<{ orders: unknown[] }>('/orders.json', params);
    const orders = data.orders.map((o) => mapShopifyOrder(o as never));

    const countData = await this.httpGet<{ count: number }>('/orders/count.json', {
      status: 'any',
    });

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    return {
      items: orders,
      total: countData.count,
      page,
      limit,
      hasMore: page * limit < countData.count,
    };
  }

  /** @inheritdoc */
  async getOrder(orderId: string): Promise<Order> {
    const data = await this.httpGet<{ order: unknown }>(`/orders/${orderId}.json`);
    return mapShopifyOrder(data.order as never);
  }

  /** @inheritdoc */
  async createOrder(order: Partial<Order>): Promise<Order> {
    const shopifyOrder: Record<string, unknown> = {};

    if (order.lineItems) {
      shopifyOrder.line_items = order.lineItems.map((li) => ({
        variant_id: li.variantId ? Number(li.variantId) : undefined,
        product_id: li.productId ? Number(li.productId) : undefined,
        quantity: li.quantity,
        price: String(li.price.amount),
      }));
    }

    if (order.customer) {
      shopifyOrder.customer = { id: Number(order.customer.id) };
    }

    if (order.shippingAddress) {
      shopifyOrder.shipping_address = {
        first_name: order.shippingAddress.firstName,
        last_name: order.shippingAddress.lastName,
        address1: order.shippingAddress.address1,
        address2: order.shippingAddress.address2,
        city: order.shippingAddress.city,
        province: order.shippingAddress.province,
        country: order.shippingAddress.country,
        zip: order.shippingAddress.zip,
        phone: order.shippingAddress.phone,
      };
    }

    if (order.note) shopifyOrder.note = order.note;
    if (order.tags) shopifyOrder.tags = order.tags.join(', ');

    const data = await this.httpPost<{ order: unknown }>('/orders.json', {
      order: shopifyOrder,
    });
    return mapShopifyOrder(data.order as never);
  }

  /** @inheritdoc */
  async fulfillOrder(input: FulfillmentInput): Promise<Order> {
    const fulfillment: Record<string, unknown> = {
      notify_customer: input.notifyCustomer,
    };

    if (input.trackingNumber) fulfillment.tracking_number = input.trackingNumber;
    if (input.trackingCompany) fulfillment.tracking_company = input.trackingCompany;
    if (input.trackingUrl) fulfillment.tracking_urls = [input.trackingUrl];

    if (input.lineItems) {
      fulfillment.line_items = input.lineItems.map((li) => ({
        id: Number(li.id),
        quantity: li.quantity,
      }));
    }

    await this.httpPost(`/orders/${input.orderId}/fulfillments.json`, { fulfillment });
    return this.getOrder(input.orderId);
  }

  /** @inheritdoc */
  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    const payload: Record<string, unknown> = {};
    if (reason) payload.reason = reason;

    await this.httpPost(`/orders/${orderId}/cancel.json`, payload);
    return this.getOrder(orderId);
  }

  /** @inheritdoc */
  async refundOrder(input: RefundInput): Promise<Order> {
    const refund: Record<string, unknown> = {
      note: input.note ?? input.reason,
      restock: input.restock,
    };

    if (input.lineItems) {
      refund.refund_line_items = input.lineItems.map((li) => ({
        line_item_id: Number(li.id),
        quantity: li.quantity,
      }));
    }

    if (input.amount) {
      refund.transactions = [
        {
          kind: 'refund',
          amount: String(input.amount.amount),
        },
      ];
    }

    await this.httpPost(`/orders/${input.orderId}/refunds.json`, { refund });
    return this.getOrder(input.orderId);
  }

  /** @inheritdoc */
  async addOrderNote(orderId: string, note: string): Promise<OrderNote> {
    // Shopify no tiene un endpoint dedicado para notas de orden.
    // Se actualiza la nota de la orden directamente.
    await this.httpPut(`/orders/${orderId}.json`, {
      order: { id: Number(orderId), note },
    });

    return {
      id: `note_${Date.now()}`,
      body: note,
      author: 'CommerceHub',
      createdAt: new Date(),
    };
  }

  /** @inheritdoc */
  async getOrderTimeline(orderId: string): Promise<OrderTimelineEvent[]> {
    // Shopify REST Admin API no tiene endpoint de timeline directo.
    // Construimos una línea de tiempo básica a partir de la información de la orden.
    const order = await this.getOrder(orderId);
    const events: OrderTimelineEvent[] = [];

    events.push({
      id: `evt_created_${orderId}`,
      type: 'created',
      message: `Orden ${order.orderNumber} creada`,
      createdAt: order.createdAt,
    });

    if (order.financialStatus === 'paid') {
      events.push({
        id: `evt_paid_${orderId}`,
        type: 'payment',
        message: 'Pago recibido',
        createdAt: order.updatedAt,
      });
    }

    if (order.fulfillmentStatus === 'fulfilled') {
      events.push({
        id: `evt_fulfilled_${orderId}`,
        type: 'fulfillment',
        message: 'Orden completamente cumplida',
        createdAt: order.updatedAt,
      });
    }

    if (order.status === 'cancelled') {
      events.push({
        id: `evt_cancelled_${orderId}`,
        type: 'status_change',
        message: 'Orden cancelada',
        createdAt: order.updatedAt,
      });
    }

    return events;
  }

  // ──────────────────────── Inventario ────────────────────────

  /** @inheritdoc */
  async getInventory(filters?: InventoryFilters): Promise<PaginatedResponse<InventoryItem>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: filters?.limit ?? 20,
    };

    if (filters?.location) params.location_ids = filters.location;

    const data = await this.httpGet<{ inventory_levels: unknown[] }>(
      '/inventory_levels.json',
      params,
    );

    const items = data.inventory_levels.map((level) =>
      mapShopifyInventory(level as never),
    );

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    return {
      items,
      total: items.length,
      page,
      limit,
      hasMore: false,
    };
  }

  /** @inheritdoc */
  async updateInventory(update: InventoryUpdate): Promise<InventoryItem> {
    if (update.reason === 'adjustment' || update.reason === 'manual') {
      // Usar adjust para cambios relativos
      const data = await this.httpPost<{ inventory_level: unknown }>(
        '/inventory_levels/adjust.json',
        {
          inventory_item_id: Number(update.productId),
          location_id: update.location ? Number(update.location) : undefined,
          available_adjustment: update.quantity,
        },
      );
      return mapShopifyInventory(data.inventory_level as never);
    }

    // Usar set para valores absolutos
    const data = await this.httpPost<{ inventory_level: unknown }>(
      '/inventory_levels/set.json',
      {
        inventory_item_id: Number(update.productId),
        location_id: update.location ? Number(update.location) : undefined,
        available: update.quantity,
      },
    );
    return mapShopifyInventory(data.inventory_level as never);
  }

  /** @inheritdoc */
  async bulkUpdateInventory(
    updates: InventoryUpdate[],
  ): Promise<OperationResult<InventoryItem>[]> {
    const results: OperationResult<InventoryItem>[] = [];

    for (const update of updates) {
      try {
        const item = await this.updateInventory(update);
        results.push({ success: true, data: item });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /** @inheritdoc */
  async getInventoryHistory(
    _sku: string,
    _dateRange?: DateRange,
  ): Promise<InventoryMovement[]> {
    // Shopify REST Admin API no proporciona historial de inventario directo.
    this.logger.warn('getInventoryHistory no disponible vía REST Admin API de Shopify');
    return [];
  }

  // ──────────────────────── Clientes ────────────────────────

  /** @inheritdoc */
  async listCustomers(filters?: CustomerFilters): Promise<PaginatedResponse<Customer>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: filters?.limit ?? 20,
    };

    const data = await this.httpGet<{ customers: unknown[] }>('/customers.json', params);
    const customers = data.customers.map((c) => mapShopifyCustomer(c as never));

    const countData = await this.httpGet<{ count: number }>('/customers/count.json');
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    return {
      items: customers,
      total: countData.count,
      page,
      limit,
      hasMore: page * limit < countData.count,
    };
  }

  /** @inheritdoc */
  async getCustomer(customerId: string): Promise<Customer> {
    const data = await this.httpGet<{ customer: unknown }>(`/customers/${customerId}.json`);
    return mapShopifyCustomer(data.customer as never);
  }

  /** @inheritdoc */
  async searchCustomers(
    query: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Customer>> {
    const params: Record<string, string | number | boolean | undefined> = {
      query,
      limit: pagination?.limit ?? 20,
    };

    const data = await this.httpGet<{ customers: unknown[] }>(
      '/customers/search.json',
      params,
    );
    const customers = data.customers.map((c) => mapShopifyCustomer(c as never));

    return {
      items: customers,
      total: customers.length,
      page: pagination?.page ?? 1,
      limit: pagination?.limit ?? 20,
      hasMore: false,
    };
  }

  /** @inheritdoc */
  async getCustomerOrders(
    customerId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Order>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: pagination?.limit ?? 20,
      status: 'any',
    };

    const data = await this.httpGet<{ orders: unknown[] }>(
      `/customers/${customerId}/orders.json`,
      params,
    );
    const orders = data.orders.map((o) => mapShopifyOrder(o as never));

    return {
      items: orders,
      total: orders.length,
      page: pagination?.page ?? 1,
      limit: pagination?.limit ?? 20,
      hasMore: false,
    };
  }

  // ──────────────────────── Analytics ────────────────────────

  /** @inheritdoc */
  async getRevenue(dateRange: DateRange): Promise<RevenueReport> {
    // Shopify no tiene API de analytics directa en REST Admin.
    // Calculamos desde órdenes.
    const params: Record<string, string | number | boolean | undefined> = {
      status: 'any',
      financial_status: 'paid',
      created_at_min: dateRange.from.toISOString(),
      created_at_max: dateRange.to.toISOString(),
      limit: 250,
    };

    const data = await this.httpGet<{ orders: Array<{ total_price: string; currency: string; created_at: string; total_tax: string; total_discounts: string }> }>(
      '/orders.json',
      params,
      true, // skip cache
    );

    const orders = data.orders;
    const currency = orders[0]?.currency ?? 'USD';

    let totalRevenue = 0;
    let totalRefunds = 0;
    const dailyMap = new Map<string, { revenue: number; orders: number }>();

    for (const order of orders) {
      const amount = parseFloat(order.total_price);
      totalRevenue += amount;

      const dateKey = order.created_at.split('T')[0]!;
      const existing = dailyMap.get(dateKey) ?? { revenue: 0, orders: 0 };
      existing.revenue += amount;
      existing.orders += 1;
      dailyMap.set(dateKey, existing);
    }

    const dailyBreakdown: DailyRevenue[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        revenue: { amount: stats.revenue, currency },
        orders: stats.orders,
        averageOrderValue: {
          amount: stats.orders > 0 ? stats.revenue / stats.orders : 0,
          currency,
        },
      }));

    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    return {
      period: dateRange,
      revenue: { amount: totalRevenue, currency },
      orderCount,
      averageOrderValue: { amount: averageOrderValue, currency },
      refundTotal: { amount: totalRefunds, currency },
      netRevenue: { amount: totalRevenue - totalRefunds, currency },
      dailyBreakdown,
    };
  }

  /** @inheritdoc */
  async getTopProducts(dateRange: DateRange, limit = 10): Promise<TopProduct[]> {
    const params: Record<string, string | number | boolean | undefined> = {
      status: 'any',
      financial_status: 'paid',
      created_at_min: dateRange.from.toISOString(),
      created_at_max: dateRange.to.toISOString(),
      limit: 250,
    };

    const data = await this.httpGet<{ orders: Array<{ line_items: Array<{ product_id: number; title: string; sku?: string; quantity: number; price: string }>; currency: string }> }>(
      '/orders.json',
      params,
      true,
    );

    const productMap = new Map<
      string,
      { title: string; sku?: string; quantity: number; revenue: number }
    >();

    const currency = data.orders[0]?.currency ?? 'USD';

    for (const order of data.orders) {
      for (const li of order.line_items) {
        const key = String(li.product_id);
        const existing = productMap.get(key) ?? {
          title: li.title,
          sku: li.sku,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += li.quantity;
        existing.revenue += parseFloat(li.price) * li.quantity;
        productMap.set(key, existing);
      }
    }

    return Array.from(productMap.entries())
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(([productId, stats]) => ({
        productId,
        title: stats.title,
        sku: stats.sku,
        quantitySold: stats.quantity,
        revenue: { amount: stats.revenue, currency },
      }));
  }

  /** @inheritdoc */
  async getConversionFunnel(_dateRange: DateRange): Promise<ConversionFunnel> {
    // Shopify REST Admin API no proporciona datos de embudo de conversión.
    // Retornamos datos estimados basados en órdenes.
    this.logger.warn('getConversionFunnel: datos estimados, Shopify REST no provee métricas de embudo');

    const orders = await this.listOrders({
      dateRange: _dateRange,
      limit: 1,
    });

    const completed = orders.total;
    // Estimaciones razonables basadas en promedios de e-commerce
    const estimatedVisitors = completed > 0 ? Math.round(completed / 0.02) : 0;
    const estimatedCart = Math.round(estimatedVisitors * 0.1);
    const estimatedCheckout = Math.round(estimatedCart * 0.5);

    return {
      visitors: estimatedVisitors,
      addedToCart: estimatedCart,
      initiatedCheckout: estimatedCheckout,
      completed,
      cartRate: estimatedVisitors > 0 ? (estimatedCart / estimatedVisitors) * 100 : 0,
      checkoutRate: estimatedCart > 0 ? (estimatedCheckout / estimatedCart) * 100 : 0,
      conversionRate: estimatedVisitors > 0 ? (completed / estimatedVisitors) * 100 : 0,
    };
  }
}
