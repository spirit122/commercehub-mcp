/**
 * @module providers/shopify/mapper
 * @description Funciones de mapeo entre el formato de la API REST Admin de Shopify
 * y el formato unificado de CommerceHub. Transforma datos en ambas direcciones.
 */

import type {
  Product,
  ProductVariant,
  ProductImage,
  CreateProductInput,
  Order,
  LineItem,
  Address,
  Customer,
  InventoryItem,
} from '../../types/index.js';
import { CustomerSegment } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos auxiliares para respuestas crudas de Shopify
// ─────────────────────────────────────────────────────────────────────────────

/** Representación cruda de una variante de Shopify. */
interface ShopifyRawVariant {
  id: number;
  title: string;
  sku?: string;
  barcode?: string;
  price: string;
  compare_at_price?: string | null;
  weight?: number;
  weight_unit?: string;
  inventory_quantity?: number;
  inventory_policy?: string;
  requires_shipping?: boolean;
  taxable?: boolean;
  inventory_item_id?: number;
}

/** Representación cruda de una imagen de Shopify. */
interface ShopifyRawImage {
  id: number;
  src: string;
  alt?: string | null;
  position: number;
  width?: number;
  height?: number;
}

/** Representación cruda de un producto de Shopify. */
interface ShopifyRawProduct {
  id: number;
  title: string;
  body_html?: string;
  handle: string;
  status: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  variants?: ShopifyRawVariant[];
  images?: ShopifyRawImage[];
  created_at: string;
  updated_at: string;
}

/** Representación cruda de una dirección de Shopify. */
interface ShopifyRawAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country?: string;
  country_code?: string;
  zip?: string;
  phone?: string;
}

/** Representación cruda de una línea de pedido de Shopify. */
interface ShopifyRawLineItem {
  id: number;
  product_id: number;
  variant_id?: number;
  title: string;
  sku?: string;
  quantity: number;
  price: string;
  total_discount?: string;
  tax_lines?: Array<{ price: string }>;
}

/** Representación cruda de una orden de Shopify. */
interface ShopifyRawOrder {
  id: number;
  name: string;
  order_number: number;
  financial_status: string;
  fulfillment_status: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  customer?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
  };
  line_items: ShopifyRawLineItem[];
  shipping_address?: ShopifyRawAddress;
  billing_address?: ShopifyRawAddress;
  subtotal_price: string;
  total_shipping_price_set?: { shop_money: { amount: string; currency_code: string } };
  total_tax: string;
  total_discounts: string;
  total_price: string;
  currency: string;
  note?: string;
  tags?: string;
  created_at: string;
  updated_at: string;
  refunds?: Array<{ id: number }>;
}

/** Representación cruda de un cliente de Shopify. */
interface ShopifyRawCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company?: string;
  orders_count: number;
  total_spent: string;
  tags?: string;
  addresses?: ShopifyRawAddress[];
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
  last_order_id?: number;
  currency?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Productos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un producto crudo de Shopify al formato unificado de CommerceHub.
 *
 * @param raw - Producto crudo de la API de Shopify.
 * @returns Producto en formato unificado.
 */
export function mapShopifyProduct(raw: ShopifyRawProduct): Product {
  const tags = raw.tags ? raw.tags.split(', ').filter(Boolean) : [];
  const variants = (raw.variants ?? []).map(mapShopifyVariant);
  const images = (raw.images ?? []).map(mapShopifyImage);

  // Extraer texto plano del HTML
  const description = raw.body_html
    ? raw.body_html.replace(/<[^>]*>/g, '').trim()
    : undefined;

  const statusMap: Record<string, Product['status']> = {
    active: 'active',
    draft: 'draft',
    archived: 'archived',
  };

  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'shopify',
    title: raw.title,
    description,
    htmlDescription: raw.body_html,
    slug: raw.handle,
    status: statusMap[raw.status] ?? 'draft',
    vendor: raw.vendor,
    productType: raw.product_type,
    tags,
    variants,
    images,
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  };
}

/**
 * Transforma datos de creación de producto al formato de la API de Shopify.
 *
 * @param input - Datos de creación en formato unificado.
 * @returns Objeto con la estructura esperada por la API de Shopify.
 */
export function mapProductToShopify(input: CreateProductInput): Record<string, unknown> {
  const product: Record<string, unknown> = {
    title: input.title,
  };

  if (input.htmlDescription) product.body_html = input.htmlDescription;
  else if (input.description) product.body_html = `<p>${input.description}</p>`;

  if (input.slug) product.handle = input.slug;
  if (input.status) product.status = input.status;
  if (input.vendor) product.vendor = input.vendor;
  if (input.productType) product.product_type = input.productType;
  if (input.tags) product.tags = input.tags.join(', ');

  if (input.variants && input.variants.length > 0) {
    product.variants = input.variants.map((v) => ({
      title: v.title,
      sku: v.sku,
      barcode: v.barcode,
      price: String(v.price.amount),
      compare_at_price: v.compareAtPrice ? String(v.compareAtPrice.amount) : undefined,
      weight: v.weight,
      weight_unit: v.weightUnit,
      inventory_quantity: v.inventoryQuantity,
      inventory_policy: v.inventoryPolicy,
      requires_shipping: v.requiresShipping,
      taxable: v.taxable,
    }));
  }

  if (input.images && input.images.length > 0) {
    product.images = input.images.map((img) => ({
      src: img.src,
      alt: img.alt,
      position: img.position,
    }));
  }

  if (input.seoTitle || input.seoDescription) {
    product.metafields_global_title_tag = input.seoTitle;
    product.metafields_global_description_tag = input.seoDescription;
  }

  return { product };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Variantes e Imágenes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma una variante cruda de Shopify al formato unificado.
 *
 * @param raw - Variante cruda de Shopify.
 * @returns Variante en formato unificado.
 */
export function mapShopifyVariant(raw: ShopifyRawVariant): ProductVariant {
  return {
    id: String(raw.id),
    externalId: String(raw.id),
    title: raw.title,
    sku: raw.sku,
    barcode: raw.barcode,
    price: { amount: parseFloat(raw.price), currency: 'USD' },
    compareAtPrice: raw.compare_at_price
      ? { amount: parseFloat(raw.compare_at_price), currency: 'USD' }
      : undefined,
    weight: raw.weight,
    weightUnit: (raw.weight_unit as ProductVariant['weightUnit']) ?? 'kg',
    inventoryQuantity: raw.inventory_quantity ?? 0,
    inventoryPolicy: (raw.inventory_policy as ProductVariant['inventoryPolicy']) ?? 'deny',
    requiresShipping: raw.requires_shipping ?? true,
    taxable: raw.taxable ?? true,
  };
}

/**
 * Transforma una imagen cruda de Shopify al formato unificado.
 */
function mapShopifyImage(raw: ShopifyRawImage): ProductImage {
  return {
    id: String(raw.id),
    src: raw.src,
    alt: raw.alt ?? undefined,
    position: raw.position,
    width: raw.width,
    height: raw.height,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Órdenes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma una orden cruda de Shopify al formato unificado de CommerceHub.
 *
 * @param raw - Orden cruda de la API de Shopify.
 * @returns Orden en formato unificado.
 */
export function mapShopifyOrder(raw: ShopifyRawOrder): Order {
  const currency = raw.currency || 'USD';

  /** Mapea financial_status de Shopify al formato unificado. */
  const financialStatusMap: Record<string, Order['financialStatus']> = {
    pending: 'pending',
    authorized: 'pending',
    paid: 'paid',
    partially_refunded: 'partially_refunded',
    refunded: 'refunded',
    voided: 'refunded',
  };

  /** Mapea fulfillment_status de Shopify al formato unificado. */
  const fulfillmentStatusMap: Record<string, Order['fulfillmentStatus']> = {
    fulfilled: 'fulfilled',
    partial: 'partial',
    null: 'unfulfilled',
  };

  /** Determina el estado general de la orden. */
  const resolveOrderStatus = (): Order['status'] => {
    if (raw.cancelled_at) return 'cancelled';
    if (raw.financial_status === 'refunded') return 'refunded';
    if (raw.fulfillment_status === 'fulfilled') return 'delivered';
    if (raw.fulfillment_status === 'partial') return 'shipped';
    if (raw.financial_status === 'paid') return 'processing';
    return 'pending';
  };

  const shippingAmount = raw.total_shipping_price_set
    ? parseFloat(raw.total_shipping_price_set.shop_money.amount)
    : 0;

  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'shopify',
    orderNumber: raw.name,
    status: resolveOrderStatus(),
    financialStatus: financialStatusMap[raw.financial_status] ?? 'pending',
    fulfillmentStatus:
      fulfillmentStatusMap[raw.fulfillment_status ?? 'null'] ?? 'unfulfilled',
    customer: {
      id: raw.customer ? String(raw.customer.id) : '',
      email: raw.customer?.email ?? '',
      firstName: raw.customer?.first_name ?? '',
      lastName: raw.customer?.last_name ?? '',
      phone: raw.customer?.phone,
    },
    lineItems: raw.line_items.map(mapShopifyLineItem),
    shippingAddress: raw.shipping_address
      ? mapShopifyAddress(raw.shipping_address)
      : undefined,
    billingAddress: raw.billing_address
      ? mapShopifyAddress(raw.billing_address)
      : undefined,
    subtotal: { amount: parseFloat(raw.subtotal_price), currency },
    shippingTotal: { amount: shippingAmount, currency },
    taxTotal: { amount: parseFloat(raw.total_tax), currency },
    discountTotal: { amount: parseFloat(raw.total_discounts), currency },
    total: { amount: parseFloat(raw.total_price), currency },
    currency,
    note: raw.note,
    tags: raw.tags ? raw.tags.split(', ').filter(Boolean) : [],
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Líneas de Pedido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma una línea de pedido cruda de Shopify al formato unificado.
 *
 * @param raw - Línea de pedido cruda de Shopify.
 * @returns Línea de pedido en formato unificado.
 */
export function mapShopifyLineItem(raw: ShopifyRawLineItem): LineItem {
  const taxAmount = (raw.tax_lines ?? []).reduce(
    (sum, t) => sum + parseFloat(t.price),
    0,
  );

  return {
    id: String(raw.id),
    productId: String(raw.product_id),
    variantId: raw.variant_id ? String(raw.variant_id) : undefined,
    title: raw.title,
    sku: raw.sku,
    quantity: raw.quantity,
    price: { amount: parseFloat(raw.price), currency: 'USD' },
    totalDiscount: {
      amount: parseFloat(raw.total_discount ?? '0'),
      currency: 'USD',
    },
    tax: { amount: taxAmount, currency: 'USD' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Direcciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma una dirección cruda de Shopify al formato unificado.
 *
 * @param raw - Dirección cruda de Shopify.
 * @returns Dirección en formato unificado.
 */
export function mapShopifyAddress(raw: ShopifyRawAddress): Address {
  return {
    firstName: raw.first_name ?? '',
    lastName: raw.last_name ?? '',
    company: raw.company,
    address1: raw.address1 ?? '',
    address2: raw.address2,
    city: raw.city ?? '',
    province: raw.province,
    provinceCode: raw.province_code,
    country: raw.country ?? '',
    countryCode: raw.country_code ?? '',
    zip: raw.zip ?? '',
    phone: raw.phone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Clientes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un cliente crudo de Shopify al formato unificado de CommerceHub.
 *
 * @param raw - Cliente crudo de la API de Shopify.
 * @returns Cliente en formato unificado.
 */
export function mapShopifyCustomer(raw: ShopifyRawCustomer): Customer {
  const totalSpent = parseFloat(raw.total_spent || '0');
  const currency = raw.currency || 'USD';
  const avgOrderValue =
    raw.orders_count > 0 ? totalSpent / raw.orders_count : 0;

  /** Calcula el segmento del cliente basado en métricas simples. */
  const resolveSegment = (): CustomerSegment => {
    if (raw.orders_count === 0) return CustomerSegment.NEW;
    if (totalSpent > 1000 && raw.orders_count > 10) return CustomerSegment.CHAMPION;
    if (totalSpent > 500 || raw.orders_count > 5) return CustomerSegment.VIP;
    if (raw.orders_count >= 2) return CustomerSegment.REGULAR;
    return CustomerSegment.NEW;
  };

  const addresses = (raw.addresses ?? []).map(mapShopifyAddress);

  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'shopify',
    email: raw.email,
    firstName: raw.first_name,
    lastName: raw.last_name,
    phone: raw.phone,
    company: raw.company,
    totalOrders: raw.orders_count,
    totalSpent: { amount: totalSpent, currency },
    averageOrderValue: { amount: avgOrderValue, currency },
    tags: raw.tags ? raw.tags.split(', ').filter(Boolean) : [],
    addresses,
    acceptsMarketing: raw.accepts_marketing,
    segment: resolveSegment(),
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un nivel de inventario crudo de Shopify al formato unificado.
 *
 * @param raw - Datos crudos de inventario de Shopify.
 * @param productInfo - Información adicional del producto asociado.
 * @returns Ítem de inventario en formato unificado.
 */
export function mapShopifyInventory(
  raw: {
    inventory_item_id: number;
    location_id: number;
    available: number;
    updated_at: string;
  },
  productInfo?: {
    sku?: string;
    productId?: string;
    productTitle?: string;
    variantTitle?: string;
    locationName?: string;
  },
): InventoryItem {
  return {
    id: String(raw.inventory_item_id),
    externalId: String(raw.inventory_item_id),
    provider: 'shopify',
    sku: productInfo?.sku ?? '',
    productId: productInfo?.productId ?? '',
    productTitle: productInfo?.productTitle ?? '',
    variantTitle: productInfo?.variantTitle,
    quantity: raw.available,
    reserved: 0,
    available: raw.available,
    location: productInfo?.locationName ?? String(raw.location_id),
    updatedAt: new Date(raw.updated_at),
  };
}
