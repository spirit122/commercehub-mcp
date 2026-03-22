/**
 * @module providers/woocommerce/mapper
 * @description Funciones de mapeo entre el formato de la API REST de WooCommerce v3
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
// Tipos auxiliares para respuestas crudas de WooCommerce
// ─────────────────────────────────────────────────────────────────────────────

/** Imagen cruda de WooCommerce. */
interface WooRawImage {
  id: number;
  src: string;
  alt?: string;
  position?: number;
}

/** Producto crudo de WooCommerce. */
interface WooRawProduct {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  stock_quantity?: number | null;
  stock_status?: string;
  manage_stock?: boolean;
  weight?: string;
  categories?: Array<{ id: number; name: string }>;
  tags?: Array<{ id: number; name: string }>;
  images?: WooRawImage[];
  variations?: number[];
  attributes?: Array<{ id: number; name: string; options: string[] }>;
  date_created: string;
  date_modified: string;
}

/** Dirección cruda de WooCommerce. */
interface WooRawAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

/** Línea de pedido cruda de WooCommerce. */
interface WooRawLineItem {
  id: number;
  product_id: number;
  variation_id?: number;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  subtotal: string;
  total: string;
  total_tax: string;
  taxes?: Array<{ total: string }>;
}

/** Orden cruda de WooCommerce. */
interface WooRawOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  subtotal?: string;
  total_tax: string;
  shipping_total: string;
  discount_total: string;
  customer_id: number;
  billing: WooRawAddress;
  shipping: WooRawAddress;
  line_items: WooRawLineItem[];
  customer_note?: string;
  date_created: string;
  date_modified: string;
  payment_method?: string;
  payment_method_title?: string;
  meta_data?: Array<{ key: string; value: unknown }>;
}

/** Cliente crudo de WooCommerce. */
interface WooRawCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username?: string;
  billing: WooRawAddress;
  shipping: WooRawAddress;
  avatar_url?: string;
  orders_count?: number;
  total_spent?: string;
  date_created: string;
  date_modified: string;
  role?: string;
  is_paying_customer?: boolean;
  meta_data?: Array<{ key: string; value: unknown }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Productos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un producto crudo de WooCommerce al formato unificado.
 *
 * @param raw - Producto crudo de la API de WooCommerce.
 * @returns Producto en formato unificado.
 */
export function mapWooProduct(raw: WooRawProduct): Product {
  const statusMap: Record<string, Product['status']> = {
    publish: 'active',
    draft: 'draft',
    pending: 'draft',
    private: 'archived',
    trash: 'archived',
  };

  const tags = (raw.tags ?? []).map((t) => t.name);
  const images: ProductImage[] = (raw.images ?? []).map((img, index) => ({
    id: String(img.id),
    src: img.src,
    alt: img.alt,
    position: img.position ?? index,
  }));

  // Producto simple como variante única
  const defaultVariant: ProductVariant = {
    id: String(raw.id),
    externalId: String(raw.id),
    title: 'Default',
    sku: raw.sku,
    price: { amount: parseFloat(raw.price || '0'), currency: 'USD' },
    compareAtPrice: raw.regular_price && raw.sale_price
      ? { amount: parseFloat(raw.regular_price), currency: 'USD' }
      : undefined,
    weight: raw.weight ? parseFloat(raw.weight) : undefined,
    weightUnit: 'kg',
    inventoryQuantity: raw.stock_quantity ?? 0,
    inventoryPolicy: raw.stock_status === 'onbackorder' ? 'continue' : 'deny',
    requiresShipping: true,
    taxable: true,
  };

  // Extraer texto plano del HTML
  const plainDescription = raw.short_description
    ? raw.short_description.replace(/<[^>]*>/g, '').trim()
    : raw.description
      ? raw.description.replace(/<[^>]*>/g, '').trim()
      : undefined;

  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'woocommerce',
    title: raw.name,
    description: plainDescription,
    htmlDescription: raw.description,
    slug: raw.slug,
    status: statusMap[raw.status] ?? 'draft',
    productType: (raw.categories ?? [])[0]?.name,
    tags,
    variants: [defaultVariant],
    images,
    createdAt: new Date(raw.date_created),
    updatedAt: new Date(raw.date_modified),
  };
}

/**
 * Transforma datos de creación de producto al formato de WooCommerce.
 *
 * @param input - Datos de creación en formato unificado.
 * @returns Objeto con la estructura esperada por la API de WooCommerce.
 */
export function mapProductToWoo(input: CreateProductInput): Record<string, unknown> {
  const product: Record<string, unknown> = {
    name: input.title,
    type: 'simple',
  };

  if (input.htmlDescription) product.description = input.htmlDescription;
  else if (input.description) product.description = input.description;

  if (input.slug) product.slug = input.slug;

  const statusMap: Record<string, string> = {
    active: 'publish',
    draft: 'draft',
    archived: 'private',
  };
  if (input.status) product.status = statusMap[input.status] ?? 'draft';

  if (input.tags) {
    product.tags = input.tags.map((t) => ({ name: t }));
  }

  if (input.variants && input.variants.length > 0) {
    const v = input.variants[0]!;
    product.regular_price = String(v.price.amount);
    if (v.sku) product.sku = v.sku;
    if (v.weight !== undefined) product.weight = String(v.weight);
    if (v.inventoryQuantity !== undefined) {
      product.manage_stock = true;
      product.stock_quantity = v.inventoryQuantity;
    }
  }

  if (input.images) {
    product.images = input.images.map((img) => ({
      src: img.src,
      alt: img.alt,
    }));
  }

  return product;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Órdenes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma una orden cruda de WooCommerce al formato unificado.
 *
 * @param raw - Orden cruda de la API de WooCommerce.
 * @returns Orden en formato unificado.
 */
export function mapWooOrder(raw: WooRawOrder): Order {
  const currency = raw.currency || 'USD';

  const statusMap: Record<string, Order['status']> = {
    pending: 'pending',
    processing: 'processing',
    'on-hold': 'pending',
    completed: 'delivered',
    cancelled: 'cancelled',
    refunded: 'refunded',
    failed: 'cancelled',
    trash: 'cancelled',
  };

  const financialMap: Record<string, Order['financialStatus']> = {
    pending: 'pending',
    processing: 'paid',
    'on-hold': 'pending',
    completed: 'paid',
    cancelled: 'pending',
    refunded: 'refunded',
    failed: 'pending',
  };

  const fulfillmentMap: Record<string, Order['fulfillmentStatus']> = {
    pending: 'unfulfilled',
    processing: 'unfulfilled',
    'on-hold': 'unfulfilled',
    completed: 'fulfilled',
    cancelled: 'unfulfilled',
    refunded: 'unfulfilled',
    failed: 'unfulfilled',
  };

  const subtotal = raw.subtotal
    ? parseFloat(raw.subtotal)
    : raw.line_items.reduce((sum, li) => sum + parseFloat(li.subtotal), 0);

  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'woocommerce',
    orderNumber: `#${raw.number}`,
    status: statusMap[raw.status] ?? 'pending',
    financialStatus: financialMap[raw.status] ?? 'pending',
    fulfillmentStatus: fulfillmentMap[raw.status] ?? 'unfulfilled',
    customer: {
      id: String(raw.customer_id),
      email: raw.billing.email ?? '',
      firstName: raw.billing.first_name ?? '',
      lastName: raw.billing.last_name ?? '',
      phone: raw.billing.phone,
    },
    lineItems: raw.line_items.map((li) => mapWooLineItem(li, currency)),
    shippingAddress: mapWooAddress(raw.shipping),
    billingAddress: mapWooAddress(raw.billing),
    subtotal: { amount: subtotal, currency },
    shippingTotal: { amount: parseFloat(raw.shipping_total), currency },
    taxTotal: { amount: parseFloat(raw.total_tax), currency },
    discountTotal: { amount: parseFloat(raw.discount_total), currency },
    total: { amount: parseFloat(raw.total), currency },
    currency,
    note: raw.customer_note,
    tags: [],
    createdAt: new Date(raw.date_created),
    updatedAt: new Date(raw.date_modified),
  };
}

/**
 * Transforma una línea de pedido cruda de WooCommerce al formato unificado.
 */
function mapWooLineItem(raw: WooRawLineItem, currency: string): LineItem {
  const discount = parseFloat(raw.subtotal) - parseFloat(raw.total);
  return {
    id: String(raw.id),
    productId: String(raw.product_id),
    variantId: raw.variation_id ? String(raw.variation_id) : undefined,
    title: raw.name,
    sku: raw.sku,
    quantity: raw.quantity,
    price: { amount: raw.price, currency },
    totalDiscount: { amount: Math.max(0, discount), currency },
    tax: { amount: parseFloat(raw.total_tax), currency },
  };
}

/**
 * Transforma una dirección cruda de WooCommerce al formato unificado.
 *
 * @param raw - Dirección cruda de WooCommerce.
 * @returns Dirección en formato unificado.
 */
export function mapWooAddress(raw: WooRawAddress): Address {
  return {
    firstName: raw.first_name ?? '',
    lastName: raw.last_name ?? '',
    company: raw.company,
    address1: raw.address_1 ?? '',
    address2: raw.address_2,
    city: raw.city ?? '',
    province: raw.state,
    country: raw.country ?? '',
    countryCode: raw.country ?? '',
    zip: raw.postcode ?? '',
    phone: raw.phone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Clientes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un cliente crudo de WooCommerce al formato unificado.
 *
 * @param raw - Cliente crudo de la API de WooCommerce.
 * @returns Cliente en formato unificado.
 */
export function mapWooCustomer(raw: WooRawCustomer): Customer {
  const totalSpent = parseFloat(raw.total_spent || '0');
  const ordersCount = raw.orders_count ?? 0;
  const avgOrderValue = ordersCount > 0 ? totalSpent / ordersCount : 0;

  const resolveSegment = (): CustomerSegment => {
    if (ordersCount === 0) return CustomerSegment.NEW;
    if (totalSpent > 1000 && ordersCount > 10) return CustomerSegment.CHAMPION;
    if (totalSpent > 500 || ordersCount > 5) return CustomerSegment.VIP;
    if (ordersCount >= 2) return CustomerSegment.REGULAR;
    return CustomerSegment.NEW;
  };

  const addresses: Address[] = [];
  if (raw.billing.address_1) addresses.push(mapWooAddress(raw.billing));
  if (raw.shipping.address_1) addresses.push(mapWooAddress(raw.shipping));

  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'woocommerce',
    email: raw.email,
    firstName: raw.first_name,
    lastName: raw.last_name,
    phone: raw.billing.phone,
    company: raw.billing.company,
    totalOrders: ordersCount,
    totalSpent: { amount: totalSpent, currency: 'USD' },
    averageOrderValue: { amount: avgOrderValue, currency: 'USD' },
    tags: [],
    addresses,
    acceptsMarketing: false,
    segment: resolveSegment(),
    createdAt: new Date(raw.date_created),
    updatedAt: new Date(raw.date_modified),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un producto WooCommerce en un ítem de inventario unificado.
 * WooCommerce maneja inventario a nivel de producto/variación, no como entidad separada.
 *
 * @param raw - Producto crudo de WooCommerce con datos de stock.
 * @returns Ítem de inventario en formato unificado.
 */
export function mapWooInventory(raw: WooRawProduct): InventoryItem {
  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'woocommerce',
    sku: raw.sku ?? '',
    productId: String(raw.id),
    productTitle: raw.name,
    quantity: raw.stock_quantity ?? 0,
    reserved: 0,
    available: raw.stock_quantity ?? 0,
    updatedAt: new Date(raw.date_modified),
  };
}
