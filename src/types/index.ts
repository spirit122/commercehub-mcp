/**
 * @module types
 * @description Punto de entrada principal para todos los tipos de CommerceHub MCP Server.
 * Re-exporta todas las definiciones de tipos, interfaces, enums y clases
 * desde los módulos individuales para facilitar las importaciones.
 *
 * @example
 * ```ts
 * import {
 *   Product,
 *   Order,
 *   Customer,
 *   InventoryItem,
 *   RevenueReport,
 *   ICommerceProvider,
 *   CommerceHubError,
 *   ErrorCode,
 * } from './types/index.js';
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos compartidos y utilidades base
// ─────────────────────────────────────────────────────────────────────────────
export {
  type PaginatedResponse,
  type PaginationParams,
  type DateRange,
  type Money,
  type SortDirection,
  type ProviderName,
  type OperationResult,
  CommerceHubError,
  ErrorCode,
} from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Productos
// ─────────────────────────────────────────────────────────────────────────────
export {
  type Product,
  type ProductVariant,
  type ProductImage,
  type ProductStatus,
  type WeightUnit,
  type InventoryPolicy,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductFilters,
  type BulkPriceUpdate,
  type ProductSyncMapping,
} from './product.js';

// ─────────────────────────────────────────────────────────────────────────────
// Órdenes
// ─────────────────────────────────────────────────────────────────────────────
export {
  type Order,
  type OrderStatus,
  type FinancialStatus,
  type FulfillmentStatus,
  type Address,
  type OrderCustomer,
  type LineItem,
  type FulfillmentInput,
  type RefundInput,
  type OrderFilters,
  type OrderNote,
  type OrderTimelineEvent,
} from './order.js';

// ─────────────────────────────────────────────────────────────────────────────
// Clientes
// ─────────────────────────────────────────────────────────────────────────────
export {
  type Customer,
  CustomerSegment,
  type CustomerFilters,
  type CustomerLifetimeValue,
  type ChurnRiskLevel,
} from './customer.js';

// ─────────────────────────────────────────────────────────────────────────────
// Inventario
// ─────────────────────────────────────────────────────────────────────────────
export {
  type InventoryItem,
  type InventoryUpdate,
  type InventoryUpdateReason,
  type InventoryMovement,
  type LowStockItem,
  type InventoryForecast,
  type InventoryFilters,
} from './inventory.js';

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────
export {
  type RevenueReport,
  type DailyRevenue,
  type TopProduct,
  type ChannelSales,
  type ConversionFunnel,
  type SalesForecast,
  type RefundAnalysis,
  type DashboardSummary,
} from './analytics.js';

// ─────────────────────────────────────────────────────────────────────────────
// Proveedor
// ─────────────────────────────────────────────────────────────────────────────
export {
  type ICommerceProvider,
  type ProviderConfig,
} from './provider.js';
