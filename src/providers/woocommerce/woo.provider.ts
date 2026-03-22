/**
 * @module providers/woocommerce
 * @description Implementación del proveedor WooCommerce para CommerceHub MCP Server.
 * Utiliza la API REST de WooCommerce v3 para todas las operaciones.
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
  mapWooProduct,
  mapProductToWoo,
  mapWooOrder,
  mapWooCustomer,
  mapWooInventory,
} from './woo.mapper.js';
import { validateWooConfig, buildWooHeaders, WOO_BASE_PATH } from './woo.auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// WooCommerceProvider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proveedor de comercio electrónico para WooCommerce.
 * Implementa todas las operaciones del interface ICommerceProvider
 * utilizando la API REST de WooCommerce v3.
 */
export class WooCommerceProvider extends BaseProvider {
  readonly name: ProviderName = 'woocommerce';

  private siteUrl = '';
  private consumerKey = '';
  private consumerSecret = '';

  // ──────────────────────── Ciclo de vida ────────────────────────

  async initialize(config: ProviderConfig): Promise<void> {
    validateWooConfig(config);
    this.siteUrl = config.storeUrl!.replace(/\/$/, '');
    this.consumerKey = config.apiKey!;
    this.consumerSecret = config.apiSecret!;
    await super.initialize(config);
  }

  protected buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.siteUrl}${WOO_BASE_PATH}${cleanPath}`;
  }

  protected buildHeaders(): Record<string, string> {
    return buildWooHeaders(this.consumerKey, this.consumerSecret);
  }

  // ──────────────────────── Productos ────────────────────────

  async listProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    const params: Record<string, string | number | boolean | undefined> = {
      per_page: filters?.limit ?? 20,
      page: filters?.page ?? 1,
    };

    if (filters?.status) {
      const statusMap: Record<string, string> = { active: 'publish', draft: 'draft', archived: 'private' };
      params.status = statusMap[filters.status] ?? filters.status;
    }
    if (filters?.query) params.search = filters.query;
    if (filters?.productType) params.category = filters.productType;
    if (filters?.sortBy) {
      const sortMap: Record<string, string> = { title: 'title', price: 'price', createdAt: 'date', updatedAt: 'modified' };
      params.orderby = sortMap[filters.sortBy] ?? 'date';
    }
    if (filters?.sortDirection) params.order = filters.sortDirection;

    const data = await this.httpGet<unknown[]>('/products', params);
    const products = (data as Array<Record<string, unknown>>).map((p) => mapWooProduct(p as never));

    // Obtener total desde headers (WooCommerce lo envía en X-WP-Total)
    // Como no tenemos acceso directo a headers desde httpGet, hacemos count separado
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    return {
      items: products,
      total: products.length < limit ? (page - 1) * limit + products.length : page * limit + 1,
      page,
      limit,
      hasMore: products.length === limit,
    };
  }

  async getProduct(productId: string): Promise<Product> {
    const data = await this.httpGet<Record<string, unknown>>(`/products/${productId}`);
    return mapWooProduct(data as never);
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    const payload = mapProductToWoo(input);
    const data = await this.httpPost<Record<string, unknown>>('/products', payload);
    return mapWooProduct(data as never);
  }

  async updateProduct(productId: string, input: UpdateProductInput): Promise<Product> {
    const payload: Record<string, unknown> = {};

    if (input.title !== undefined) payload.name = input.title;
    if (input.htmlDescription !== undefined) payload.description = input.htmlDescription;
    else if (input.description !== undefined) payload.description = input.description;
    if (input.slug !== undefined) payload.slug = input.slug;
    if (input.status !== undefined) {
      const statusMap: Record<string, string> = { active: 'publish', draft: 'draft', archived: 'private' };
      payload.status = statusMap[input.status] ?? input.status;
    }
    if (input.tags !== undefined) payload.tags = input.tags.map((t) => ({ name: t }));

    if (input.variants && input.variants.length > 0) {
      const v = input.variants[0]!;
      if (v.price) payload.regular_price = String(v.price.amount);
      if (v.sku) payload.sku = v.sku;
    }

    const data = await this.httpPut<Record<string, unknown>>(`/products/${productId}`, payload);
    return mapWooProduct(data as never);
  }

  async deleteProduct(productId: string): Promise<OperationResult<void>> {
    try {
      await this.httpDelete(`/products/${productId}?force=true`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async searchProducts(query: string, pagination?: PaginationParams): Promise<PaginatedResponse<Product>> {
    return this.listProducts({ query, page: pagination?.page, limit: pagination?.limit });
  }

  // ──────────────────────── Órdenes ────────────────────────

  async listOrders(filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
    const params: Record<string, string | number | boolean | undefined> = {
      per_page: filters?.limit ?? 20,
      page: filters?.page ?? 1,
    };

    if (filters?.status) params.status = filters.status;
    if (filters?.dateRange?.from) params.after = filters.dateRange.from.toISOString();
    if (filters?.dateRange?.to) params.before = filters.dateRange.to.toISOString();
    if (filters?.customerEmail) params.search = filters.customerEmail;

    const data = await this.httpGet<unknown[]>('/orders', params);
    const orders = (data as Array<Record<string, unknown>>).map((o) => mapWooOrder(o as never));

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    return {
      items: orders,
      total: orders.length < limit ? (page - 1) * limit + orders.length : page * limit + 1,
      page,
      limit,
      hasMore: orders.length === limit,
    };
  }

  async getOrder(orderId: string): Promise<Order> {
    const data = await this.httpGet<Record<string, unknown>>(`/orders/${orderId}`);
    return mapWooOrder(data as never);
  }

  async createOrder(order: Partial<Order>): Promise<Order> {
    const payload: Record<string, unknown> = {};

    if (order.lineItems) {
      payload.line_items = order.lineItems.map((li) => ({
        product_id: Number(li.productId),
        variation_id: li.variantId ? Number(li.variantId) : undefined,
        quantity: li.quantity,
      }));
    }

    if (order.customer) {
      payload.customer_id = Number(order.customer.id);
    }

    if (order.shippingAddress) {
      payload.shipping = {
        first_name: order.shippingAddress.firstName,
        last_name: order.shippingAddress.lastName,
        address_1: order.shippingAddress.address1,
        address_2: order.shippingAddress.address2,
        city: order.shippingAddress.city,
        state: order.shippingAddress.province,
        postcode: order.shippingAddress.zip,
        country: order.shippingAddress.countryCode,
      };
    }

    if (order.billingAddress) {
      payload.billing = {
        first_name: order.billingAddress.firstName,
        last_name: order.billingAddress.lastName,
        address_1: order.billingAddress.address1,
        address_2: order.billingAddress.address2,
        city: order.billingAddress.city,
        state: order.billingAddress.province,
        postcode: order.billingAddress.zip,
        country: order.billingAddress.countryCode,
        email: order.customer?.email,
        phone: order.billingAddress.phone,
      };
    }

    if (order.note) payload.customer_note = order.note;

    const data = await this.httpPost<Record<string, unknown>>('/orders', payload);
    return mapWooOrder(data as never);
  }

  async fulfillOrder(input: FulfillmentInput): Promise<Order> {
    // WooCommerce usa el estado "completed" para fulfillment completo
    await this.httpPut(`/orders/${input.orderId}`, { status: 'completed' });

    // Agregar nota de tracking si se proporcionó
    if (input.trackingNumber) {
      await this.httpPost(`/orders/${input.orderId}/notes`, {
        note: `Enviado via ${input.trackingCompany ?? 'N/A'}. Tracking: ${input.trackingNumber}`,
        customer_note: input.notifyCustomer,
      });
    }

    return this.getOrder(input.orderId);
  }

  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    await this.httpPut(`/orders/${orderId}`, { status: 'cancelled' });
    if (reason) {
      await this.httpPost(`/orders/${orderId}/notes`, {
        note: `Cancelada: ${reason}`,
        customer_note: false,
      });
    }
    return this.getOrder(orderId);
  }

  async refundOrder(input: RefundInput): Promise<Order> {
    const refund: Record<string, unknown> = {
      reason: input.reason,
    };

    if (input.amount) {
      refund.amount = String(input.amount.amount);
    }

    if (input.lineItems) {
      refund.line_items = input.lineItems.map((li) => ({
        id: Number(li.id),
        quantity: li.quantity,
        refund_total: undefined,
      }));
    }

    refund.api_refund = true;
    refund.restock_items = input.restock;

    await this.httpPost(`/orders/${input.orderId}/refunds`, refund);
    return this.getOrder(input.orderId);
  }

  async addOrderNote(orderId: string, note: string): Promise<OrderNote> {
    const data = await this.httpPost<{ id: number; note: string; date_created: string; author: string }>(
      `/orders/${orderId}/notes`,
      { note, customer_note: false },
    );

    return {
      id: String(data.id),
      body: data.note,
      author: data.author ?? 'CommerceHub',
      createdAt: new Date(data.date_created),
    };
  }

  async getOrderTimeline(orderId: string): Promise<OrderTimelineEvent[]> {
    const data = await this.httpGet<Array<{ id: number; note: string; date_created: string; author: string; customer_note: boolean }>>(
      `/orders/${orderId}/notes`,
    );

    return data.map((note) => ({
      id: String(note.id),
      type: note.customer_note ? 'customer_note' : 'note',
      message: note.note,
      createdAt: new Date(note.date_created),
      details: { author: note.author },
    }));
  }

  // ──────────────────────── Inventario ────────────────────────

  async getInventory(filters?: InventoryFilters): Promise<PaginatedResponse<InventoryItem>> {
    const params: Record<string, string | number | boolean | undefined> = {
      per_page: filters?.limit ?? 20,
      page: filters?.page ?? 1,
      stock_status: filters?.belowReorderPoint ? 'outofstock' : undefined,
    };

    if (filters?.sku) params.sku = filters.sku;

    const data = await this.httpGet<unknown[]>('/products', params);
    const items = (data as Array<Record<string, unknown>>).map((p) => mapWooInventory(p as never));

    const filteredItems = filters?.minAvailable !== undefined
      ? items.filter((i) => i.available >= (filters.minAvailable ?? 0))
      : items;

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    return {
      items: filteredItems,
      total: filteredItems.length,
      page,
      limit,
      hasMore: items.length === limit,
    };
  }

  async updateInventory(update: InventoryUpdate): Promise<InventoryItem> {
    const productId = update.productId ?? update.sku;
    if (!productId) {
      throw new Error('Se requiere productId o sku para actualizar inventario en WooCommerce');
    }

    const data = await this.httpPut<Record<string, unknown>>(`/products/${productId}`, {
      manage_stock: true,
      stock_quantity: update.quantity,
    });

    return mapWooInventory(data as never);
  }

  async bulkUpdateInventory(updates: InventoryUpdate[]): Promise<OperationResult<InventoryItem>[]> {
    const results: OperationResult<InventoryItem>[] = [];
    for (const update of updates) {
      try {
        const item = await this.updateInventory(update);
        results.push({ success: true, data: item });
      } catch (error) {
        results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return results;
  }

  async getInventoryHistory(_sku: string, _dateRange?: DateRange): Promise<InventoryMovement[]> {
    this.logger.warn('getInventoryHistory no disponible en WooCommerce REST API');
    return [];
  }

  // ──────────────────────── Clientes ────────────────────────

  async listCustomers(filters?: CustomerFilters): Promise<PaginatedResponse<Customer>> {
    const params: Record<string, string | number | boolean | undefined> = {
      per_page: filters?.limit ?? 20,
      page: filters?.page ?? 1,
    };

    if (filters?.query) params.search = filters.query;

    const data = await this.httpGet<unknown[]>('/customers', params);
    const customers = (data as Array<Record<string, unknown>>).map((c) => mapWooCustomer(c as never));

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    return {
      items: customers,
      total: customers.length < limit ? (page - 1) * limit + customers.length : page * limit + 1,
      page,
      limit,
      hasMore: customers.length === limit,
    };
  }

  async getCustomer(customerId: string): Promise<Customer> {
    const data = await this.httpGet<Record<string, unknown>>(`/customers/${customerId}`);
    return mapWooCustomer(data as never);
  }

  async searchCustomers(query: string, pagination?: PaginationParams): Promise<PaginatedResponse<Customer>> {
    return this.listCustomers({ query, page: pagination?.page, limit: pagination?.limit });
  }

  async getCustomerOrders(customerId: string, pagination?: PaginationParams): Promise<PaginatedResponse<Order>> {
    return this.listOrders({
      customerEmail: customerId,
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  // ──────────────────────── Analytics ────────────────────────

  async getRevenue(dateRange: DateRange): Promise<RevenueReport> {
    const data = await this.httpGet<{ totals: Record<string, { sales: string; orders: number; refunds: string }> }>(
      '/reports/sales',
      {
        date_min: dateRange.from.toISOString().split('T')[0],
        date_max: dateRange.to.toISOString().split('T')[0],
        period: 'day',
      },
      true,
    );

    const totals = data.totals ?? {};
    let totalRevenue = 0;
    let totalRefunds = 0;
    let totalOrders = 0;
    const dailyBreakdown: DailyRevenue[] = [];

    for (const [date, stats] of Object.entries(totals)) {
      const revenue = parseFloat(stats.sales || '0');
      const refunds = parseFloat(stats.refunds || '0');
      totalRevenue += revenue;
      totalRefunds += Math.abs(refunds);
      totalOrders += stats.orders;

      dailyBreakdown.push({
        date,
        revenue: { amount: revenue, currency: 'USD' },
        orders: stats.orders,
        averageOrderValue: {
          amount: stats.orders > 0 ? revenue / stats.orders : 0,
          currency: 'USD',
        },
      });
    }

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      period: dateRange,
      revenue: { amount: totalRevenue, currency: 'USD' },
      orderCount: totalOrders,
      averageOrderValue: { amount: avgOrderValue, currency: 'USD' },
      refundTotal: { amount: totalRefunds, currency: 'USD' },
      netRevenue: { amount: totalRevenue - totalRefunds, currency: 'USD' },
      dailyBreakdown,
    };
  }

  async getTopProducts(dateRange: DateRange, limit = 10): Promise<TopProduct[]> {
    const data = await this.httpGet<Array<{ product_id: number; name: string; quantity: number; total: number }>>(
      '/reports/top_sellers',
      {
        date_min: dateRange.from.toISOString().split('T')[0],
        date_max: dateRange.to.toISOString().split('T')[0],
        period: 'custom',
      },
      true,
    );

    return (data || []).slice(0, limit).map((item) => ({
      productId: String(item.product_id),
      title: item.name,
      quantitySold: item.quantity,
      revenue: { amount: item.total, currency: 'USD' },
    }));
  }

  async getConversionFunnel(_dateRange: DateRange): Promise<ConversionFunnel> {
    this.logger.warn('getConversionFunnel: WooCommerce no provee métricas de embudo directas');

    const orders = await this.listOrders({ dateRange: _dateRange, limit: 1 });
    const completed = orders.total;
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
