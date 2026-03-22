/**
 * @module providers/base
 * @description Clase abstracta base para todos los proveedores de comercio electrónico.
 * Proporciona caché integrado, rate limiting, reintentos automáticos, logging
 * y métodos HTTP unificados. Todos los proveedores concretos deben extender esta clase.
 */

import { request } from 'undici';
import type {
  ICommerceProvider,
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
  TopProduct,
  ConversionFunnel,
} from '../types/index.js';
import { CommerceHubError, ErrorCode } from '../types/index.js';
import { LRUCache } from '../utils/cache.js';
import { getRateLimiter, type RateLimiter } from '../utils/rate-limiter.js';
import { withRetry } from '../utils/retry.js';
import { createLogger, type Logger } from '../utils/logger.js';
import { handleProviderError } from '../utils/errors.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────

/** Respuesta HTTP interna procesada. */
export interface HttpResponse<T = unknown> {
  /** Código de estado HTTP. */
  statusCode: number;
  /** Cuerpo de la respuesta deserializado. */
  body: T;
  /** Cabeceras de la respuesta. */
  headers: Record<string, string | string[] | undefined>;
}

// ─────────────────────────────────────────────────────────────────────────────
// BaseProvider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clase abstracta base para proveedores de comercio electrónico.
 * Ofrece infraestructura compartida: caché, rate limiting, HTTP con reintentos
 * y logging. Los proveedores concretos solo necesitan implementar los métodos
 * abstractos y las operaciones específicas de su API.
 *
 * @example
 * ```ts
 * class ShopifyProvider extends BaseProvider {
 *   readonly name: ProviderName = 'shopify';
 *   protected buildUrl(path: string): string { ... }
 *   protected buildHeaders(): Record<string, string> { ... }
 * }
 * ```
 */
export abstract class BaseProvider implements ICommerceProvider {
  /** Nombre identificador del proveedor. */
  abstract readonly name: ProviderName;

  /** Configuración activa del proveedor. */
  protected config!: ProviderConfig;

  /** Indica si el proveedor fue inicializado correctamente. */
  protected initialized = false;

  /** Caché LRU para respuestas GET. */
  protected readonly cache: LRUCache<unknown>;

  /** Rate limiter para controlar frecuencia de requests. */
  protected rateLimiter!: RateLimiter;

  /** Logger del proveedor. */
  protected readonly logger: Logger;

  constructor(config?: ProviderConfig) {
    this.cache = new LRUCache({ maxSize: 500, ttl: 300_000 });
    this.logger = createLogger('provider');

    if (config) {
      this.config = config;
    }
  }

  // ──────────────────────── Ciclo de vida ────────────────────────

  /**
   * Inicializa el proveedor con la configuración dada.
   * Las subclases pueden sobrescribir para agregar validación adicional.
   */
  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.rateLimiter = getRateLimiter(this.name);
    this.initialized = true;
    this.logger.info(`Proveedor ${this.name} inicializado`);
  }

  /** Verifica si el proveedor está configurado e inicializado. */
  isConfigured(): boolean {
    return this.initialized && !!this.config;
  }

  // ──────────────────────── Métodos abstractos ────────────────────────

  /**
   * Construye la URL completa para un path de la API del proveedor.
   * @param path - Ruta relativa del endpoint.
   */
  protected abstract buildUrl(path: string): string;

  /**
   * Construye las cabeceras HTTP requeridas por el proveedor (auth, content-type, etc.).
   */
  protected abstract buildHeaders(): Record<string, string>;

  // ──────────────────────── Métodos HTTP ────────────────────────

  /**
   * Realiza una solicitud HTTP GET con caché, rate limiting y reintentos.
   *
   * @param path - Ruta relativa del endpoint.
   * @param queryParams - Parámetros de query string opcionales.
   * @param skipCache - Si es `true`, omite la caché.
   * @returns El cuerpo de la respuesta deserializado.
   */
  protected async httpGet<T = unknown>(
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>,
    skipCache = false,
  ): Promise<T> {
    const url = this.buildUrlWithParams(path, queryParams);
    const cacheKey = `GET:${url}`;

    if (!skipCache) {
      const cached = this.cache.get(cacheKey) as T | undefined;
      if (cached !== undefined) {
        this.logger.debug('Cache hit', { url });
        return cached;
      }
    }

    const response = await this.executeRequest<T>('GET', url);
    this.cache.set(cacheKey, response.body);
    return response.body;
  }

  /**
   * Realiza una solicitud HTTP POST con rate limiting y reintentos.
   *
   * @param path - Ruta relativa del endpoint.
   * @param body - Cuerpo de la solicitud.
   * @returns El cuerpo de la respuesta deserializado.
   */
  protected async httpPost<T = unknown>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const response = await this.executeRequest<T>('POST', url, body);
    return response.body;
  }

  /**
   * Realiza una solicitud HTTP PUT con rate limiting y reintentos.
   *
   * @param path - Ruta relativa del endpoint.
   * @param body - Cuerpo de la solicitud.
   * @returns El cuerpo de la respuesta deserializado.
   */
  protected async httpPut<T = unknown>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const response = await this.executeRequest<T>('PUT', url, body);
    return response.body;
  }

  /**
   * Realiza una solicitud HTTP DELETE con rate limiting y reintentos.
   *
   * @param path - Ruta relativa del endpoint.
   * @returns El cuerpo de la respuesta deserializado.
   */
  protected async httpDelete<T = unknown>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    const response = await this.executeRequest<T>('DELETE', url);
    return response.body;
  }

  // ──────────────────────── Ejecución HTTP interna ────────────────────────

  /**
   * Ejecuta una solicitud HTTP con rate limiting, reintentos y manejo de errores.
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<HttpResponse<T>> {
    this.ensureInitialized();

    await this.rateLimiter.acquire();

    this.logger.debug(`${method} ${url}`, body ? { bodyPreview: '...' } : undefined);

    try {
      const result = await withRetry(
        async () => {
          const headers = this.buildHeaders();
          const options: Record<string, unknown> = {
            method,
            headers,
          };

          if (body !== undefined && body !== null) {
            options.body = JSON.stringify(body);
          }

          const response = await request(url, options);
          const responseBody = await response.body.text();
          let parsed: T;

          try {
            parsed = JSON.parse(responseBody) as T;
          } catch {
            parsed = responseBody as unknown as T;
          }

          if (response.statusCode >= 400) {
            const errorCode = this.mapHttpStatusToErrorCode(response.statusCode);
            throw new CommerceHubError(
              `HTTP ${response.statusCode} en ${method} ${url}`,
              errorCode,
              this.name,
              response.statusCode,
              { body: parsed },
            );
          }

          const responseHeaders: Record<string, string | string[] | undefined> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            responseHeaders[key] = value;
          }

          return {
            statusCode: response.statusCode,
            body: parsed,
            headers: responseHeaders,
          };
        },
        {
          maxRetries: this.config?.maxRetries ?? 3,
          baseDelay: 1000,
          retryOn: (error) => {
            if (error instanceof CommerceHubError) {
              return (
                error.code === ErrorCode.RATE_LIMITED ||
                error.code === ErrorCode.NETWORK_ERROR ||
                (error.statusCode !== undefined && error.statusCode >= 500)
              );
            }
            return true;
          },
        },
      );

      this.logger.debug(`${method} ${url} -> ${result.statusCode}`);
      return result;
    } catch (error) {
      this.logger.error(`Error en ${method} ${url}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw handleProviderError(error, this.name);
    }
  }

  // ──────────────────────── Utilidades ────────────────────────

  /**
   * Verifica que el proveedor esté inicializado antes de realizar operaciones.
   * @throws {CommerceHubError} Si el proveedor no está inicializado.
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new CommerceHubError(
        `El proveedor ${this.name} no ha sido inicializado. Llama a initialize() primero.`,
        ErrorCode.PROVIDER_ERROR,
        this.name,
      );
    }
  }

  /**
   * Construye una URL con parámetros de query string.
   */
  protected buildUrlWithParams(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = this.buildUrl(path);
    if (!params) return url;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }

    const qs = searchParams.toString();
    return qs ? `${url}?${qs}` : url;
  }

  /**
   * Mapea un código de estado HTTP a un ErrorCode de CommerceHub.
   */
  private mapHttpStatusToErrorCode(statusCode: number): ErrorCode {
    if (statusCode === 401 || statusCode === 403) return ErrorCode.AUTH_ERROR;
    if (statusCode === 404) return ErrorCode.NOT_FOUND;
    if (statusCode === 422 || statusCode === 400) return ErrorCode.VALIDATION_ERROR;
    if (statusCode === 429) return ErrorCode.RATE_LIMITED;
    return ErrorCode.PROVIDER_ERROR;
  }

  /** Limpia toda la caché del proveedor. */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Caché limpiada');
  }

  // ──────────────────────── Implementaciones default (not implemented) ────────

  async listProducts(_filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    throw new CommerceHubError(
      `listProducts no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getProduct(_productId: string): Promise<Product> {
    throw new CommerceHubError(
      `getProduct no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async createProduct(_input: CreateProductInput): Promise<Product> {
    throw new CommerceHubError(
      `createProduct no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async updateProduct(_productId: string, _input: UpdateProductInput): Promise<Product> {
    throw new CommerceHubError(
      `updateProduct no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async deleteProduct(_productId: string): Promise<OperationResult<void>> {
    throw new CommerceHubError(
      `deleteProduct no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async searchProducts(
    _query: string,
    _pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Product>> {
    throw new CommerceHubError(
      `searchProducts no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async listOrders(_filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
    throw new CommerceHubError(
      `listOrders no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getOrder(_orderId: string): Promise<Order> {
    throw new CommerceHubError(
      `getOrder no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async createOrder(_order: Partial<Order>): Promise<Order> {
    throw new CommerceHubError(
      `createOrder no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async fulfillOrder(_input: FulfillmentInput): Promise<Order> {
    throw new CommerceHubError(
      `fulfillOrder no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async cancelOrder(_orderId: string, _reason?: string): Promise<Order> {
    throw new CommerceHubError(
      `cancelOrder no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async refundOrder(_input: RefundInput): Promise<Order> {
    throw new CommerceHubError(
      `refundOrder no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async addOrderNote(_orderId: string, _note: string): Promise<OrderNote> {
    throw new CommerceHubError(
      `addOrderNote no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getOrderTimeline(_orderId: string): Promise<OrderTimelineEvent[]> {
    throw new CommerceHubError(
      `getOrderTimeline no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getInventory(_filters?: InventoryFilters): Promise<PaginatedResponse<InventoryItem>> {
    throw new CommerceHubError(
      `getInventory no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async updateInventory(_update: InventoryUpdate): Promise<InventoryItem> {
    throw new CommerceHubError(
      `updateInventory no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async bulkUpdateInventory(_updates: InventoryUpdate[]): Promise<OperationResult<InventoryItem>[]> {
    throw new CommerceHubError(
      `bulkUpdateInventory no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getInventoryHistory(_sku: string, _dateRange?: DateRange): Promise<InventoryMovement[]> {
    throw new CommerceHubError(
      `getInventoryHistory no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async listCustomers(_filters?: CustomerFilters): Promise<PaginatedResponse<Customer>> {
    throw new CommerceHubError(
      `listCustomers no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getCustomer(_customerId: string): Promise<Customer> {
    throw new CommerceHubError(
      `getCustomer no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async searchCustomers(
    _query: string,
    _pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Customer>> {
    throw new CommerceHubError(
      `searchCustomers no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getCustomerOrders(
    _customerId: string,
    _pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Order>> {
    throw new CommerceHubError(
      `getCustomerOrders no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getRevenue(_dateRange: DateRange): Promise<RevenueReport> {
    throw new CommerceHubError(
      `getRevenue no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getTopProducts(_dateRange: DateRange, _limit?: number): Promise<TopProduct[]> {
    throw new CommerceHubError(
      `getTopProducts no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }

  async getConversionFunnel(_dateRange: DateRange): Promise<ConversionFunnel> {
    throw new CommerceHubError(
      `getConversionFunnel no implementado en ${this.name}`,
      ErrorCode.PROVIDER_ERROR,
      this.name,
    );
  }
}
