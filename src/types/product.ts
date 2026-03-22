/**
 * @module product
 * @description Tipos relacionados con productos, variantes, imágenes y operaciones
 * de catálogo en CommerceHub MCP Server.
 */

import type { Money, PaginationParams, ProviderName, SortDirection } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Enums y tipos auxiliares
// ─────────────────────────────────────────────────────────────────────────────

/** Estado de publicación de un producto. */
export type ProductStatus = 'active' | 'draft' | 'archived';

/** Unidad de peso para variantes de producto. */
export type WeightUnit = 'kg' | 'g' | 'lb' | 'oz';

/** Política de inventario para variantes. */
export type InventoryPolicy = 'deny' | 'continue';

// ─────────────────────────────────────────────────────────────────────────────
// Imagen de producto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Imagen asociada a un producto.
 */
export interface ProductImage {
  /** Identificador interno de la imagen. */
  id: string;
  /** URL de la imagen. */
  src: string;
  /** Texto alternativo (accesibilidad y SEO). */
  alt?: string;
  /** Posición de orden dentro de la galería (comienza en 0). */
  position: number;
  /** Ancho de la imagen en píxeles. */
  width?: number;
  /** Alto de la imagen en píxeles. */
  height?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Variante de producto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variante de un producto (talla, color, etc.).
 * Cada variante representa una combinación única comprable.
 */
export interface ProductVariant {
  /** Identificador interno de la variante. */
  id: string;
  /** Identificador en el proveedor externo. */
  externalId?: string;
  /** Nombre descriptivo de la variante (ej. "Azul / XL"). */
  title: string;
  /** Código SKU (Stock Keeping Unit). */
  sku?: string;
  /** Código de barras (EAN, UPC, ISBN, etc.). */
  barcode?: string;
  /** Precio de venta de la variante. */
  price: Money;
  /** Precio de comparación (precio tachado / "antes"). */
  compareAtPrice?: Money;
  /** Peso numérico de la variante. */
  weight?: number;
  /** Unidad de peso. */
  weightUnit?: WeightUnit;
  /** Cantidad actual en inventario. */
  inventoryQuantity: number;
  /** Política de inventario: 'deny' rechaza ventas sin stock, 'continue' permite. */
  inventoryPolicy: InventoryPolicy;
  /** Indica si la variante requiere envío físico. */
  requiresShipping: boolean;
  /** Indica si la variante está sujeta a impuestos. */
  taxable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Producto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Producto unificado de comercio electrónico.
 * Normaliza la representación entre distintos proveedores (Shopify, WooCommerce, etc.).
 *
 * @example
 * ```ts
 * const producto: Product = {
 *   id: 'prod_001',
 *   externalId: '7654321',
 *   provider: 'shopify',
 *   title: 'Camiseta Premium',
 *   description: 'Camiseta de algodón orgánico.',
 *   slug: 'camiseta-premium',
 *   status: 'active',
 *   variants: [variante1],
 *   images: [imagen1],
 *   tags: ['algodón', 'premium'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface Product {
  /** Identificador interno unificado del producto. */
  id: string;
  /** Identificador del producto en el proveedor externo. */
  externalId: string;
  /** Proveedor de origen del producto. */
  provider: ProviderName;
  /** Título / nombre del producto. */
  title: string;
  /** Descripción en texto plano. */
  description?: string;
  /** Descripción en formato HTML. */
  htmlDescription?: string;
  /** Slug URL-friendly del producto. */
  slug: string;
  /** Estado de publicación del producto. */
  status: ProductStatus;
  /** Fabricante o marca. */
  vendor?: string;
  /** Tipo o categoría del producto. */
  productType?: string;
  /** Etiquetas para clasificación y búsqueda. */
  tags: string[];
  /** Lista de variantes del producto (al menos una). */
  variants: ProductVariant[];
  /** Galería de imágenes del producto. */
  images: ProductImage[];
  /** Título SEO para motores de búsqueda. */
  seoTitle?: string;
  /** Descripción SEO para motores de búsqueda. */
  seoDescription?: string;
  /** Fecha de creación del producto en el proveedor. */
  createdAt: Date;
  /** Fecha de última actualización del producto en el proveedor. */
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inputs de creación y actualización
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Datos requeridos para crear un nuevo producto.
 */
export interface CreateProductInput {
  /** Título del producto (obligatorio). */
  title: string;
  /** Descripción en texto plano. */
  description?: string;
  /** Descripción en formato HTML. */
  htmlDescription?: string;
  /** Slug personalizado (se genera automáticamente si no se provee). */
  slug?: string;
  /** Estado de publicación inicial. */
  status?: ProductStatus;
  /** Fabricante o marca. */
  vendor?: string;
  /** Tipo o categoría del producto. */
  productType?: string;
  /** Etiquetas para clasificación. */
  tags?: string[];
  /** Variantes iniciales del producto. */
  variants?: Omit<ProductVariant, 'id' | 'externalId'>[];
  /** URLs de imágenes a asociar al producto. */
  images?: Omit<ProductImage, 'id'>[];
  /** Título SEO. */
  seoTitle?: string;
  /** Descripción SEO. */
  seoDescription?: string;
}

/**
 * Datos para actualizar un producto existente.
 * Todos los campos son opcionales; solo se actualizan los campos provistos.
 */
export interface UpdateProductInput {
  /** Nuevo título del producto. */
  title?: string;
  /** Nueva descripción en texto plano. */
  description?: string;
  /** Nueva descripción en HTML. */
  htmlDescription?: string;
  /** Nuevo slug URL-friendly. */
  slug?: string;
  /** Nuevo estado de publicación. */
  status?: ProductStatus;
  /** Nuevo fabricante o marca. */
  vendor?: string;
  /** Nuevo tipo de producto. */
  productType?: string;
  /** Nuevas etiquetas (reemplaza las existentes). */
  tags?: string[];
  /** Variantes a actualizar o agregar. */
  variants?: Partial<ProductVariant>[];
  /** Imágenes a actualizar o agregar. */
  images?: Partial<ProductImage>[];
  /** Nuevo título SEO. */
  seoTitle?: string;
  /** Nueva descripción SEO. */
  seoDescription?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros y búsqueda
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtros disponibles para listado y búsqueda de productos.
 */
export interface ProductFilters extends PaginationParams {
  /** Filtrar por estado de publicación. */
  status?: ProductStatus;
  /** Filtrar por fabricante o marca. */
  vendor?: string;
  /** Filtrar por tipo de producto. */
  productType?: string;
  /** Filtrar por colección o categoría. */
  collection?: string;
  /** Búsqueda de texto libre (título, descripción, SKU). */
  query?: string;
  /** Solo productos creados después de esta fecha. */
  createdAfter?: Date;
  /** Precio mínimo para filtrar (sobre la primera variante). */
  priceMin?: number;
  /** Precio máximo para filtrar (sobre la primera variante). */
  priceMax?: number;
  /** Campo por el cual ordenar. */
  sortBy?: 'title' | 'price' | 'createdAt' | 'updatedAt';
  /** Dirección de ordenamiento. */
  sortDirection?: SortDirection;
}

// ─────────────────────────────────────────────────────────────────────────────
// Operaciones masivas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entrada para actualización masiva de precios.
 * Permite identificar el producto/variante por ID o SKU.
 */
export interface BulkPriceUpdate {
  /** Identificador del producto o variante. */
  id?: string;
  /** SKU del producto o variante (alternativa al id). */
  sku?: string;
  /** Nuevo precio a establecer. */
  newPrice: Money;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sincronización
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapeo de campos para sincronización de productos entre proveedores.
 * Define cómo se corresponden los campos del origen al destino.
 */
export interface ProductSyncMapping {
  /** Proveedor de origen de los datos. */
  sourceProvider: ProviderName;
  /** Proveedor de destino al que se sincronizan los datos. */
  targetProvider: ProviderName;
  /**
   * Diccionario de mapeo de campos.
   * Clave: nombre del campo en el destino.
   * Valor: nombre del campo en el origen.
   *
   * @example
   * ```ts
   * fieldMappings: {
   *   title: 'name',
   *   description: 'short_description',
   *   price: 'regular_price',
   * }
   * ```
   */
  fieldMappings: Record<string, string>;
  /** Indica si se deben sincronizar las imágenes. */
  syncImages?: boolean;
  /** Indica si se deben sincronizar las variantes. */
  syncVariants?: boolean;
  /** Indica si se deben sincronizar las etiquetas. */
  syncTags?: boolean;
}
