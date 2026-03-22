/**
 * @module providers/mercadolibre
 * @description Implementación del proveedor MercadoLibre para CommerceHub MCP Server.
 * Utiliza la API pública de MercadoLibre con autenticación OAuth2.
 * Soporta operaciones de items (productos), órdenes, clientes (vía órdenes)
 * y analytics básicos.
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
import { CommerceHubError, ErrorCode } from '../../types/index.js';
import { BaseProvider } from '../base.provider.js';
import {
  mapMeliProduct,
  mapMeliOrder,
  mapMeliCustomer,
  mapMeliInventory,
  mapProductToMeli,
} from './meli.mapper.js';
import {
  validateMeliConfig,
  buildMeliHeaders,
  getSiteId,
  MELI_BASE_URL,
} from './meli.auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// MeliProvider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proveedor de comercio electrónico para MercadoLibre.
 * Implementa operaciones sobre items, órdenes y clientes utilizando
 * la API REST de MercadoLibre con autenticación OAuth2.
 */
export class MeliProvider extends BaseProvider {
  readonly name: ProviderName = 'mercadolibre';

  /** Token de acceso actual. */
  private accessToken = '';
  /** ID del usuario autenticado. */
  private userId = '';
  /** Site ID para operaciones por país (ej: MLA). */
  private siteId = 'MLA';

  // ──────────────────────── Ciclo de vida ────────────────────────

  async initialize(config: ProviderConfig): Promise<void> {
    validateMeliConfig(config);
    this.accessToken = config.accessToken!;
    this.siteId = getSiteId(config.extra?.countryCode as string | undefined);

    await super.initialize(config);

    // Obtener el user ID del usuario autenticado
    try {
      const userData = await this.httpGet<{ id: number }>('/users/me');
      this.userId = String(userData.id);
      this.logger.info(`MercadoLibre: usuario ${this.userId} autenticado`);
    } catch (error) {
      this.logger.warn('No se pudo obtener el user ID de MercadoLibre', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  protected buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${MELI_BASE_URL}${cleanPath}`;
  }

  protected buildHeaders(): Record<string, string> {
    return buildMeliHeaders(this.accessToken);
  }

  // ──────────────────────── Productos (Items) ────────────────────────

  async listProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    if (!this.userId) {
      throw new CommerceHubError(
        'Se requiere user ID para listar items de MercadoLibre',
        ErrorCode.PROVIDER_ERROR,
        'mercadolibre',
      );
    }

    const limit = filters?.limit ?? 20;
    const offset = ((filters?.page ?? 1) - 1) * limit;

    const params: Record<string, string | number | boolean | undefined> = {
      limit,
      offset,
    };

    if (filters?.status) {
      const statusMap: Record<string, string> = { active: 'active', draft: 'paused', archived: 'closed' };
      params.status = statusMap[filters.status] ?? filters.status;
    }

    if (filters?.query) {
      // Usar búsqueda por site si hay query
      const searchData = await this.httpGet<{ results: unknown[]; paging: { total: number } }>(
        `/sites/${this.siteId}/search`,
        { q: filters.query, seller_id: this.userId, limit, offset },
      );

      const products: Product[] = [];
      for (const item of searchData.results) {
        const itemId = (item as { id: string }).id;
        try {
          const fullItem = await this.httpGet<Record<string, unknown>>(`/items/${itemId}`);
          products.push(mapMeliProduct(fullItem as never));
        } catch {
          // Si falla un item individual, continuamos
        }
      }

      return {
        items: products,
        total: searchData.paging.total,
        page: filters.page ?? 1,
        limit,
        hasMore: offset + limit < searchData.paging.total,
      };
    }

    // Listar items del usuario
    const data = await this.httpGet<{ results: string[]; paging: { total: number } }>(
      `/users/${this.userId}/items/search`,
      params,
    );

    // Los resultados son IDs, necesitamos obtener los detalles de cada item
    const products: Product[] = [];
    const itemIds = data.results.slice(0, limit);

    if (itemIds.length > 0) {
      // MercadoLibre permite obtener múltiples items en una sola request
      const multiData = await this.httpGet<Array<{ code: number; body: Record<string, unknown> }>>(
        '/items',
        { ids: itemIds.join(',') },
      );

      for (const item of multiData) {
        if (item.code === 200) {
          products.push(mapMeliProduct(item.body as never));
        }
      }
    }

    const page = filters?.page ?? 1;
    return {
      items: products,
      total: data.paging.total,
      page,
      limit,
      hasMore: offset + limit < data.paging.total,
    };
  }

  async getProduct(productId: string): Promise<Product> {
    const data = await this.httpGet<Record<string, unknown>>(`/items/${productId}`);

    // Obtener descripción separadamente
    try {
      const desc = await this.httpGet<{ plain_text?: string }>(`/items/${productId}/description`);
      (data as Record<string, unknown>).description = desc;
    } catch {
      // La descripción puede no existir
    }

    return mapMeliProduct(data as never);
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    const price = input.variants?.[0]?.price.amount ?? 0;
    const currency = input.variants?.[0]?.price.currency ?? 'ARS';
    const quantity = input.variants?.[0]?.inventoryQuantity ?? 1;

    // MercadoLibre requiere una categoría, usamos la proporcionada o una genérica
    const categoryId = input.productType ?? 'MLA1055'; // Celulares como default

    const payload = mapProductToMeli(
      {
        title: input.title,
        description: input.description,
        price,
        currency,
        quantity,
      },
      categoryId,
      this.siteId,
    );

    const data = await this.httpPost<Record<string, unknown>>('/items', payload);
    return mapMeliProduct(data as never);
  }

  async updateProduct(productId: string, input: UpdateProductInput): Promise<Product> {
    const payload: Record<string, unknown> = {};

    if (input.title !== undefined) payload.title = input.title;
    if (input.status !== undefined) {
      const statusMap: Record<string, string> = { active: 'active', draft: 'paused', archived: 'closed' };
      payload.status = statusMap[input.status] ?? input.status;
    }

    if (input.variants && input.variants.length > 0) {
      const v = input.variants[0]!;
      if (v.price) payload.price = v.price.amount;
    }

    await this.httpPut(`/items/${productId}`, payload);
    return this.getProduct(productId);
  }

  async deleteProduct(productId: string): Promise<OperationResult<void>> {
    try {
      // MercadoLibre no permite eliminar items, solo cerrarlos
      await this.httpPut(`/items/${productId}`, { status: 'closed' });
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
    const limit = filters?.limit ?? 20;
    const offset = ((filters?.page ?? 1) - 1) * limit;

    const params: Record<string, string | number | boolean | undefined> = {
      seller: this.userId,
      limit,
      offset,
      sort: 'date_desc',
    };

    if (filters?.status) {
      const statusMap: Record<string, string> = {
        pending: 'payment_required',
        processing: 'paid',
        cancelled: 'cancelled',
      };
      params['order.status'] = statusMap[filters.status] ?? filters.status;
    }

    if (filters?.dateRange?.from) {
      params['order.date_created.from'] = filters.dateRange.from.toISOString();
    }
    if (filters?.dateRange?.to) {
      params['order.date_created.to'] = filters.dateRange.to.toISOString();
    }

    const data = await this.httpGet<{ results: unknown[]; paging: { total: number } }>(
      '/orders/search',
      params,
    );

    const orders = data.results.map((o) => mapMeliOrder(o as never));
    const page = filters?.page ?? 1;

    return {
      items: orders,
      total: data.paging.total,
      page,
      limit,
      hasMore: offset + limit < data.paging.total,
    };
  }

  async getOrder(orderId: string): Promise<Order> {
    const data = await this.httpGet<Record<string, unknown>>(`/orders/${orderId}`);
    return mapMeliOrder(data as never);
  }

  async createOrder(_order: Partial<Order>): Promise<Order> {
    throw new CommerceHubError(
      'MercadoLibre no permite crear órdenes mediante API - las órdenes se crean cuando un comprador realiza una compra',
      ErrorCode.PROVIDER_ERROR,
      'mercadolibre',
    );
  }

  async fulfillOrder(input: FulfillmentInput): Promise<Order> {
    // MercadoLibre maneja fulfillment a través de shipments
    // Buscar el shipment asociado
    const shipments = await this.httpGet<{ results: Array<{ id: number }> }>(
      `/orders/${input.orderId}/shipments`,
    );

    if (shipments.results.length > 0) {
      const shipmentId = shipments.results[0]!.id;

      if (input.trackingNumber) {
        await this.httpPut(`/shipments/${shipmentId}`, {
          tracking_number: input.trackingNumber,
        });
      }
    }

    return this.getOrder(input.orderId);
  }

  async cancelOrder(_orderId: string, _reason?: string): Promise<Order> {
    throw new CommerceHubError(
      'MercadoLibre no permite cancelar órdenes directamente vía API - use mediaciones o reclamos',
      ErrorCode.PROVIDER_ERROR,
      'mercadolibre',
    );
  }

  async refundOrder(_input: RefundInput): Promise<Order> {
    throw new CommerceHubError(
      'Los reembolsos de MercadoLibre se gestionan a través de reclamos y mediaciones',
      ErrorCode.PROVIDER_ERROR,
      'mercadolibre',
    );
  }

  async addOrderNote(orderId: string, note: string): Promise<OrderNote> {
    // MercadoLibre tiene sistema de mensajería entre vendedor y comprador
    const order = await this.getOrder(orderId);
    const buyerId = order.customer.id;

    await this.httpPost(`/messages/packs/${orderId}/sellers/${this.userId}`, {
      from: { user_id: this.userId },
      to: { user_id: buyerId },
      text: note,
    });

    return {
      id: `note_${Date.now()}`,
      body: note,
      author: 'CommerceHub',
      createdAt: new Date(),
    };
  }

  async getOrderTimeline(orderId: string): Promise<OrderTimelineEvent[]> {
    const order = await this.getOrder(orderId);

    const events: OrderTimelineEvent[] = [{
      id: `evt_created_${orderId}`,
      type: 'created',
      message: `Orden ${orderId} creada`,
      createdAt: order.createdAt,
    }];

    if (order.financialStatus === 'paid') {
      events.push({
        id: `evt_paid_${orderId}`,
        type: 'payment',
        message: 'Pago confirmado',
        createdAt: order.updatedAt,
      });
    }

    if (order.fulfillmentStatus === 'fulfilled') {
      events.push({
        id: `evt_delivered_${orderId}`,
        type: 'fulfillment',
        message: 'Entregado al comprador',
        createdAt: order.updatedAt,
      });
    }

    return events;
  }

  // ──────────────────────── Inventario ────────────────────────

  async getInventory(filters?: InventoryFilters): Promise<PaginatedResponse<InventoryItem>> {
    // En MercadoLibre el inventario está en cada item
    const productsList = await this.listProducts({
      page: filters?.page,
      limit: filters?.limit,
    });

    const items: InventoryItem[] = productsList.items.map((p) => ({
      id: p.id,
      externalId: p.externalId,
      provider: 'mercadolibre' as const,
      sku: p.variants[0]?.sku ?? p.id,
      productId: p.id,
      productTitle: p.title,
      quantity: p.variants.reduce((sum, v) => sum + v.inventoryQuantity, 0),
      reserved: 0,
      available: p.variants.reduce((sum, v) => sum + v.inventoryQuantity, 0),
      updatedAt: p.updatedAt,
    }));

    return {
      items,
      total: productsList.total,
      page: productsList.page,
      limit: productsList.limit,
      hasMore: productsList.hasMore,
    };
  }

  async updateInventory(update: InventoryUpdate): Promise<InventoryItem> {
    const itemId = update.productId ?? update.sku;
    if (!itemId) {
      throw new CommerceHubError(
        'Se requiere productId (item ID) para actualizar inventario en MercadoLibre',
        ErrorCode.VALIDATION_ERROR,
        'mercadolibre',
      );
    }

    await this.httpPut(`/items/${itemId}`, {
      available_quantity: update.quantity,
    });

    const item = await this.httpGet<Record<string, unknown>>(`/items/${itemId}`);
    return mapMeliInventory(item as never);
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
    this.logger.warn('getInventoryHistory no disponible en la API de MercadoLibre');
    return [];
  }

  // ──────────────────────── Clientes ────────────────────────

  async listCustomers(filters?: CustomerFilters): Promise<PaginatedResponse<Customer>> {
    // MercadoLibre no tiene API de clientes; extraemos compradores de las órdenes
    const orders = await this.listOrders({ limit: 50 });

    const buyerMap = new Map<string, { buyer: unknown; orders: number; spent: number; currency: string }>();

    for (const order of orders.items) {
      const key = order.customer.id;
      const existing = buyerMap.get(key);
      if (existing) {
        existing.orders += 1;
        existing.spent += order.total.amount;
      } else {
        buyerMap.set(key, {
          buyer: order.customer,
          orders: 1,
          spent: order.total.amount,
          currency: order.currency,
        });
      }
    }

    const customers = Array.from(buyerMap.values()).map((entry) => {
      const buyer = entry.buyer as { id: string; email: string; firstName: string; lastName: string; phone?: string };
      return mapMeliCustomer(
        {
          id: Number(buyer.id),
          nickname: `${buyer.firstName} ${buyer.lastName}`,
          email: buyer.email,
          first_name: buyer.firstName,
          last_name: buyer.lastName,
          phone: buyer.phone ? { number: buyer.phone } : undefined,
        },
        entry.orders,
        entry.spent,
        entry.currency,
      );
    });

    const limit = filters?.limit ?? 20;
    const page = filters?.page ?? 1;
    const start = (page - 1) * limit;

    return {
      items: customers.slice(start, start + limit),
      total: customers.length,
      page,
      limit,
      hasMore: start + limit < customers.length,
    };
  }

  async getCustomer(customerId: string): Promise<Customer> {
    // Obtener órdenes del comprador para construir el perfil
    const orders = await this.httpGet<{ results: unknown[]; paging: { total: number } }>(
      '/orders/search',
      { seller: this.userId, buyer: customerId, limit: 50 },
    );

    const ordersList = orders.results.map((o) => mapMeliOrder(o as never));
    const totalSpent = ordersList.reduce((sum, o) => sum + o.total.amount, 0);
    const currency = ordersList[0]?.currency ?? 'ARS';

    const firstOrder = ordersList[ordersList.length - 1];
    if (!firstOrder) {
      throw new CommerceHubError(
        `Cliente ${customerId} no encontrado en órdenes de MercadoLibre`,
        ErrorCode.NOT_FOUND,
        'mercadolibre',
      );
    }

    return mapMeliCustomer(
      {
        id: Number(customerId),
        nickname: `${firstOrder.customer.firstName} ${firstOrder.customer.lastName}`,
        email: firstOrder.customer.email,
        first_name: firstOrder.customer.firstName,
        last_name: firstOrder.customer.lastName,
        phone: firstOrder.customer.phone ? { number: firstOrder.customer.phone } : undefined,
      },
      ordersList.length,
      totalSpent,
      currency,
    );
  }

  async searchCustomers(query: string, pagination?: PaginationParams): Promise<PaginatedResponse<Customer>> {
    // Filtrar clientes del listado por nombre/email
    const all = await this.listCustomers({ limit: 100 });
    const q = query.toLowerCase();
    const filtered = all.items.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q),
    );

    const limit = pagination?.limit ?? 20;
    return {
      items: filtered.slice(0, limit),
      total: filtered.length,
      page: pagination?.page ?? 1,
      limit,
      hasMore: false,
    };
  }

  async getCustomerOrders(customerId: string, pagination?: PaginationParams): Promise<PaginatedResponse<Order>> {
    const limit = pagination?.limit ?? 20;
    const offset = ((pagination?.page ?? 1) - 1) * limit;

    const data = await this.httpGet<{ results: unknown[]; paging: { total: number } }>(
      '/orders/search',
      { seller: this.userId, buyer: customerId, limit, offset },
    );

    const orders = data.results.map((o) => mapMeliOrder(o as never));

    return {
      items: orders,
      total: data.paging.total,
      page: pagination?.page ?? 1,
      limit,
      hasMore: offset + limit < data.paging.total,
    };
  }

  // ──────────────────────── Analytics ────────────────────────

  async getRevenue(dateRange: DateRange): Promise<RevenueReport> {
    // Calcular desde órdenes pagadas
    const allOrders: Order[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
      const result = await this.listOrders({
        dateRange,
        page,
        limit: 50,
      });
      allOrders.push(...result.items);
      hasMore = result.hasMore;
      page++;
    }

    const paidOrders = allOrders.filter((o) => o.financialStatus === 'paid');
    const currency = paidOrders[0]?.currency ?? 'ARS';

    let totalRevenue = 0;
    const dailyMap = new Map<string, { revenue: number; orders: number }>();

    for (const order of paidOrders) {
      totalRevenue += order.total.amount;
      const dateKey = order.createdAt.toISOString().split('T')[0]!;
      const existing = dailyMap.get(dateKey) ?? { revenue: 0, orders: 0 };
      existing.revenue += order.total.amount;
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

    const orderCount = paidOrders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    return {
      period: dateRange,
      revenue: { amount: totalRevenue, currency },
      orderCount,
      averageOrderValue: { amount: avgOrderValue, currency },
      refundTotal: { amount: 0, currency },
      netRevenue: { amount: totalRevenue, currency },
      dailyBreakdown,
    };
  }

  async getTopProducts(dateRange: DateRange, limit = 10): Promise<TopProduct[]> {
    const allOrders: Order[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) {
      const result = await this.listOrders({ dateRange, page, limit: 50 });
      allOrders.push(...result.items);
      hasMore = result.hasMore;
      page++;
    }

    const productMap = new Map<string, { title: string; quantity: number; revenue: number }>();
    const currency = allOrders[0]?.currency ?? 'ARS';

    for (const order of allOrders) {
      if (order.financialStatus !== 'paid') continue;
      for (const li of order.lineItems) {
        const existing = productMap.get(li.productId) ?? {
          title: li.title,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += li.quantity;
        existing.revenue += li.price.amount * li.quantity;
        productMap.set(li.productId, existing);
      }
    }

    return Array.from(productMap.entries())
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(([productId, stats]) => ({
        productId,
        title: stats.title,
        quantitySold: stats.quantity,
        revenue: { amount: stats.revenue, currency },
      }));
  }

  async getConversionFunnel(_dateRange: DateRange): Promise<ConversionFunnel> {
    this.logger.warn('getConversionFunnel: MercadoLibre no provee métricas de embudo directas');

    const orders = await this.listOrders({ dateRange: _dateRange, limit: 1 });
    const completed = orders.total;
    // MercadoLibre tiene tasas de conversión típicas diferentes
    const estimatedVisitors = completed > 0 ? Math.round(completed / 0.01) : 0;
    const estimatedCart = Math.round(estimatedVisitors * 0.05);
    const estimatedCheckout = Math.round(estimatedCart * 0.4);

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
