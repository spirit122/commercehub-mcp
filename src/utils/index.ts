/**
 * @module utils
 * @description Punto de entrada para todas las utilidades de CommerceHub MCP Server.
 * Re-exporta cache, rate limiter, retry, logger, validación, moneda,
 * paginación y manejo de errores.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────
export { LRUCache } from './cache.js';
export type { LRUCacheOptions, CacheStats } from './cache.js';

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiter
// ─────────────────────────────────────────────────────────────────────────────
export { RateLimiter, getRateLimiter, createRateLimiter, resetAllRateLimiters } from './rate-limiter.js';
export type { RateLimiterOptions, RateLimiterStats } from './rate-limiter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Retry
// ─────────────────────────────────────────────────────────────────────────────
export { withRetry, withRetryWrapper, isRetryableByDefault } from './retry.js';
export type { RetryOptions, RetryAttemptInfo } from './retry.js';

// ─────────────────────────────────────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────────────────────────────────────
export { Logger, createLogger } from './logger.js';
export type { LogLevel, LoggerBindings } from './logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────────────────────
export {
  validateInput,
  providerSchema,
  paginationSchema,
  dateRangeSchema,
  moneySchema,
  sortDirectionSchema,
  productStatusSchema,
  productFiltersSchema,
  createProductSchema,
  updateProductSchema,
  orderStatusSchema,
  financialStatusSchema,
  fulfillmentStatusSchema,
  orderFiltersSchema,
  fulfillmentSchema,
  refundSchema,
  customerSegmentSchema,
  customerFiltersSchema,
  inventoryUpdateReasonSchema,
  inventoryFiltersSchema,
  inventoryUpdateSchema,
  bulkInventoryUpdateSchema,
  analyticsPeriodSchema,
  analyticsParamsSchema,
} from './validator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Moneda
// ─────────────────────────────────────────────────────────────────────────────
export {
  formatMoney,
  parseMoney,
  sumMoney,
  multiplyMoney,
  percentChange,
  CURRENCY_SYMBOLS,
} from './currency.js';

// ─────────────────────────────────────────────────────────────────────────────
// Paginación
// ─────────────────────────────────────────────────────────────────────────────
export { paginate, buildPaginationInfo, mergePaginatedResults } from './pagination.js';
export type { PaginationInfo } from './pagination.js';

// ─────────────────────────────────────────────────────────────────────────────
// Errores
// ─────────────────────────────────────────────────────────────────────────────
export {
  handleProviderError,
  isRetryableError,
  formatErrorForMCP,
  notFoundError,
  authError,
  validationError,
  providerError,
  rateLimitError,
  CommerceHubError,
  ErrorCode,
} from './errors.js';
export type { MCPErrorResponse } from './errors.js';
