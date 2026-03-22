/**
 * @module validator
 * @description Validación de datos con Zod para CommerceHub MCP Server.
 * Define schemas reutilizables para todos los parámetros de las herramientas
 * del sistema y proporciona una función centralizada de validación.
 */

import { z } from 'zod';
import { CommerceHubError, ErrorCode } from '../types/common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Schemas base
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema para los nombres de proveedores soportados.
 */
export const providerSchema = z.enum([
  'shopify',
  'woocommerce',
  'stripe',
  'mercadolibre',
]);

/**
 * Schema para parámetros de paginación.
 * page comienza en 1, limit entre 1 y 100.
 */
export const paginationSchema = z.object({
  /** Número de página (mínimo 1, por defecto 1). */
  page: z.number().int().min(1).default(1),
  /** Elementos por página (mínimo 1, máximo 100, por defecto 20). */
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Schema para rangos de fechas con strings ISO 8601.
 */
export const dateRangeSchema = z.object({
  /** Fecha de inicio (string ISO 8601). */
  from: z.string().datetime({ message: 'La fecha "from" debe ser un string ISO 8601 válido' }),
  /** Fecha de fin (string ISO 8601). */
  to: z.string().datetime({ message: 'La fecha "to" debe ser un string ISO 8601 válido' }),
}).refine(
  (data) => new Date(data.from) <= new Date(data.to),
  { message: 'La fecha "from" debe ser anterior o igual a "to"' },
);

/**
 * Schema para valores monetarios.
 */
export const moneySchema = z.object({
  /** Monto numérico (puede ser decimal). */
  amount: z.number().finite(),
  /** Código de moneda ISO 4217 (ej. 'USD', 'EUR', 'ARS'). */
  currency: z.string().min(3).max(3).toUpperCase(),
});

/**
 * Schema para dirección de ordenamiento.
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']);

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de filtros de productos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema para el estado de publicación de productos.
 */
export const productStatusSchema = z.enum(['active', 'draft', 'archived']);

/**
 * Schema para filtros de listado de productos.
 */
export const productFiltersSchema = paginationSchema.extend({
  /** Filtrar por estado de publicación. */
  status: productStatusSchema.optional(),
  /** Filtrar por fabricante o marca. */
  vendor: z.string().min(1).optional(),
  /** Filtrar por tipo de producto. */
  productType: z.string().min(1).optional(),
  /** Filtrar por colección o categoría. */
  collection: z.string().min(1).optional(),
  /** Búsqueda de texto libre. */
  query: z.string().min(1).optional(),
  /** Solo productos creados después de esta fecha (ISO 8601). */
  createdAfter: z.string().datetime().optional(),
  /** Precio mínimo. */
  priceMin: z.number().min(0).optional(),
  /** Precio máximo. */
  priceMax: z.number().min(0).optional(),
  /** Campo de ordenamiento. */
  sortBy: z.enum(['title', 'price', 'createdAt', 'updatedAt']).optional(),
  /** Dirección de ordenamiento. */
  sortDirection: sortDirectionSchema.optional(),
}).refine(
  (data) => !(data.priceMin != null && data.priceMax != null && data.priceMin > data.priceMax),
  { message: 'priceMin no puede ser mayor que priceMax' },
);

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de creación/actualización de productos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema para crear un nuevo producto.
 */
export const createProductSchema = z.object({
  /** Título del producto (obligatorio). */
  title: z.string().min(1, 'El título es obligatorio').max(500),
  /** Descripción en texto plano. */
  description: z.string().optional(),
  /** Descripción en HTML. */
  htmlDescription: z.string().optional(),
  /** Slug URL-friendly. */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido').optional(),
  /** Estado de publicación. */
  status: productStatusSchema.optional(),
  /** Fabricante o marca. */
  vendor: z.string().optional(),
  /** Tipo de producto. */
  productType: z.string().optional(),
  /** Etiquetas. */
  tags: z.array(z.string()).optional(),
  /** Variantes iniciales. */
  variants: z.array(z.object({
    title: z.string().min(1),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    price: moneySchema,
    compareAtPrice: moneySchema.optional(),
    weight: z.number().min(0).optional(),
    weightUnit: z.enum(['kg', 'g', 'lb', 'oz']).optional(),
    inventoryQuantity: z.number().int().min(0),
    inventoryPolicy: z.enum(['deny', 'continue']).default('deny'),
    requiresShipping: z.boolean().default(true),
    taxable: z.boolean().default(true),
  })).optional(),
  /** URLs de imágenes. */
  images: z.array(z.object({
    src: z.string().url(),
    alt: z.string().optional(),
    position: z.number().int().min(0),
    width: z.number().int().min(1).optional(),
    height: z.number().int().min(1).optional(),
  })).optional(),
  /** Título SEO. */
  seoTitle: z.string().max(70).optional(),
  /** Descripción SEO. */
  seoDescription: z.string().max(320).optional(),
});

/**
 * Schema para actualizar un producto existente.
 * Todos los campos son opcionales.
 */
export const updateProductSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  htmlDescription: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido').optional(),
  status: productStatusSchema.optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  variants: z.array(z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    price: moneySchema.optional(),
    compareAtPrice: moneySchema.optional(),
    weight: z.number().min(0).optional(),
    weightUnit: z.enum(['kg', 'g', 'lb', 'oz']).optional(),
    inventoryQuantity: z.number().int().min(0).optional(),
    inventoryPolicy: z.enum(['deny', 'continue']).optional(),
    requiresShipping: z.boolean().optional(),
    taxable: z.boolean().optional(),
  })).optional(),
  images: z.array(z.object({
    id: z.string().optional(),
    src: z.string().url().optional(),
    alt: z.string().optional(),
    position: z.number().int().min(0).optional(),
  })).optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(320).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Se debe proveer al menos un campo para actualizar' },
);

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de filtros de órdenes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema para estados de órdenes.
 */
export const orderStatusSchema = z.enum([
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const financialStatusSchema = z.enum([
  'pending',
  'paid',
  'partially_refunded',
  'refunded',
]);

export const fulfillmentStatusSchema = z.enum([
  'unfulfilled',
  'partial',
  'fulfilled',
]);

/**
 * Schema para filtros de listado de órdenes.
 */
export const orderFiltersSchema = paginationSchema.extend({
  /** Filtrar por estado general. */
  status: orderStatusSchema.optional(),
  /** Filtrar por estado financiero. */
  financialStatus: financialStatusSchema.optional(),
  /** Filtrar por estado de fulfillment. */
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
  /** Rango de fechas. */
  dateRange: dateRangeSchema.optional(),
  /** Email del cliente. */
  customerEmail: z.string().email('Email inválido').optional(),
  /** Total mínimo. */
  minTotal: z.number().min(0).optional(),
  /** Total máximo. */
  maxTotal: z.number().min(0).optional(),
  /** Campo de ordenamiento. */
  sortBy: z.enum(['orderNumber', 'total', 'createdAt', 'updatedAt']).optional(),
  /** Dirección de ordenamiento. */
  sortDirection: sortDirectionSchema.optional(),
}).refine(
  (data) => !(data.minTotal != null && data.maxTotal != null && data.minTotal > data.maxTotal),
  { message: 'minTotal no puede ser mayor que maxTotal' },
);

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de fulfillment y refund
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema de líneas de fulfillment/refund parcial.
 */
const lineItemRefSchema = z.object({
  /** ID de la línea de pedido. */
  id: z.string().min(1),
  /** Cantidad. */
  quantity: z.number().int().min(1),
});

/**
 * Schema para registrar el fulfillment de una orden.
 */
export const fulfillmentSchema = z.object({
  /** ID de la orden. */
  orderId: z.string().min(1, 'El orderId es obligatorio'),
  /** Número de seguimiento. */
  trackingNumber: z.string().optional(),
  /** Empresa de transporte. */
  trackingCompany: z.string().optional(),
  /** URL de seguimiento. */
  trackingUrl: z.string().url('URL de tracking inválida').optional(),
  /** Líneas a cumplir (parcial). */
  lineItems: z.array(lineItemRefSchema).optional(),
  /** Notificar al cliente. */
  notifyCustomer: z.boolean(),
});

/**
 * Schema para procesar un reembolso.
 */
export const refundSchema = z.object({
  /** ID de la orden. */
  orderId: z.string().min(1, 'El orderId es obligatorio'),
  /** Monto total a reembolsar. */
  amount: moneySchema.optional(),
  /** Líneas a reembolsar. */
  lineItems: z.array(lineItemRefSchema).min(1, 'Se requiere al menos una línea para reembolsar'),
  /** Motivo del reembolso. */
  reason: z.string().min(1, 'El motivo del reembolso es obligatorio'),
  /** Nota interna. */
  note: z.string().optional(),
  /** Reponer inventario. */
  restock: z.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de filtros de clientes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema para segmentos de clientes.
 */
export const customerSegmentSchema = z.enum([
  'VIP',
  'REGULAR',
  'NEW',
  'AT_RISK',
  'LOST',
  'CHAMPION',
]);

/**
 * Schema para filtros de listado de clientes.
 */
export const customerFiltersSchema = paginationSchema.extend({
  /** Filtrar por segmento. */
  segment: customerSegmentSchema.optional(),
  /** Búsqueda de texto libre. */
  query: z.string().min(1).optional(),
  /** Mínimo de órdenes. */
  minOrders: z.number().int().min(0).optional(),
  /** Mínimo gastado. */
  minSpent: z.number().min(0).optional(),
  /** Última orden antes de (ISO 8601). */
  lastOrderBefore: z.string().datetime().optional(),
  /** Última orden después de (ISO 8601). */
  lastOrderAfter: z.string().datetime().optional(),
  /** Acepta marketing. */
  acceptsMarketing: z.boolean().optional(),
  /** Campo de ordenamiento. */
  sortBy: z.enum(['totalSpent', 'totalOrders', 'lastOrderAt', 'createdAt']).optional(),
  /** Dirección de ordenamiento. */
  sortDirection: sortDirectionSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de filtros de inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema para motivos de actualización de inventario.
 */
export const inventoryUpdateReasonSchema = z.enum([
  'received',
  'sold',
  'returned',
  'adjustment',
  'damaged',
  'manual',
]);

/**
 * Schema para filtros de inventario.
 */
export const inventoryFiltersSchema = paginationSchema.extend({
  /** Filtrar por ubicación. */
  location: z.string().min(1).optional(),
  /** Solo ítems por debajo del punto de reorden. */
  belowReorderPoint: z.boolean().optional(),
  /** Filtrar por SKU. */
  sku: z.string().min(1).optional(),
  /** Filtrar por ID de producto. */
  productId: z.string().min(1).optional(),
  /** Mínimo disponible. */
  minAvailable: z.number().int().min(0).optional(),
  /** Máximo disponible. */
  maxAvailable: z.number().int().min(0).optional(),
}).refine(
  (data) => !(data.minAvailable != null && data.maxAvailable != null && data.minAvailable > data.maxAvailable),
  { message: 'minAvailable no puede ser mayor que maxAvailable' },
);

/**
 * Schema para actualización de inventario.
 */
export const inventoryUpdateSchema = z.object({
  /** SKU del producto/variante. */
  sku: z.string().min(1).optional(),
  /** ID del producto. */
  productId: z.string().min(1).optional(),
  /** Nueva cantidad o ajuste. */
  quantity: z.number().int(),
  /** Motivo del ajuste. */
  reason: inventoryUpdateReasonSchema,
  /** Ubicación del ajuste. */
  location: z.string().optional(),
}).refine(
  (data) => data.sku != null || data.productId != null,
  { message: 'Se requiere al menos "sku" o "productId"' },
);

/**
 * Schema para actualización masiva de inventario.
 */
export const bulkInventoryUpdateSchema = z.array(inventoryUpdateSchema).min(1).max(100);

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de analytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema para períodos de analytics predefinidos.
 */
export const analyticsPeriodSchema = z.enum([
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'custom',
]);

/**
 * Schema para parámetros de consultas de analytics.
 */
export const analyticsParamsSchema = z.object({
  /** Período predefinido o 'custom' para rango personalizado. */
  period: analyticsPeriodSchema.default('last_30_days'),
  /** Rango personalizado (obligatorio si period es 'custom'). */
  dateRange: dateRangeSchema.optional(),
  /** Comparar con período anterior. */
  compare: z.boolean().default(false),
  /** Proveedores a incluir (todos si vacío). */
  providers: z.array(providerSchema).optional(),
}).refine(
  (data) => data.period !== 'custom' || data.dateRange != null,
  { message: 'Se requiere "dateRange" cuando el período es "custom"' },
);

// ─────────────────────────────────────────────────────────────────────────────
// Función de validación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida datos de entrada contra un schema Zod.
 * Si la validación falla, lanza un CommerceHubError con código VALIDATION_ERROR
 * y los detalles de los errores encontrados.
 *
 * @typeParam T - Tipo de salida del schema (inferido automáticamente).
 * @param schema - Schema Zod contra el cual validar.
 * @param data - Datos a validar.
 * @returns Los datos validados y transformados según el schema.
 * @throws CommerceHubError con código VALIDATION_ERROR si la validación falla.
 *
 * @example
 * ```ts
 * const filters = validateInput(productFiltersSchema, rawParams);
 * // filters tiene el tipo inferido del schema con defaults aplicados.
 * ```
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  // Formatear los errores de Zod en un mensaje legible.
  const errorMessages = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(raíz)';
    return `  - ${path}: ${issue.message}`;
  });

  const detailMessage = errorMessages.join('\n');

  throw new CommerceHubError(
    `Validación fallida:\n${detailMessage}`,
    ErrorCode.VALIDATION_ERROR,
    undefined,
    400,
    {
      issues: result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      })),
    },
  );
}
