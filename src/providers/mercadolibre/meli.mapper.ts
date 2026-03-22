/**
 * @module providers/mercadolibre/mapper
 * @description Funciones de mapeo entre el formato de la API de MercadoLibre
 * y el formato unificado de CommerceHub. MercadoLibre tiene una estructura
 * de datos particular con items, publicaciones y órdenes.
 */

import type {
  Product,
  ProductVariant,
  ProductImage,
  Order,
  LineItem,
  Address,
  Customer,
  InventoryItem,
} from '../../types/index.js';
import { CustomerSegment } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos auxiliares para respuestas crudas de MercadoLibre
// ─────────────────────────────────────────────────────────────────────────────

/** Variación cruda de MercadoLibre. */
interface MeliRawVariation {
  id: number;
  price: number;
  available_quantity: number;
  sold_quantity?: number;
  attribute_combinations?: Array<{
    id: string;
    name: string;
    value_name: string;
  }>;
  picture_ids?: string[];
}

/** Imagen cruda de MercadoLibre. */
interface MeliRawPicture {
  id: string;
  url: string;
  secure_url: string;
  size?: string;
  max_size?: string;
}

/** Item (producto/publicación) crudo de MercadoLibre. */
interface MeliRawItem {
  id: string;
  title: string;
  category_id: string;
  price: number;
  currency_id: string;
  available_quantity: number;
  sold_quantity: number;
  buying_mode: string;
  listing_type_id: string;
  condition: string;
  permalink: string;
  thumbnail: string;
  pictures?: MeliRawPicture[];
  variations?: MeliRawVariation[];
  attributes?: Array<{
    id: string;
    name: string;
    value_name: string | null;
  }>;
  status: string;
  tags?: string[];
  date_created: string;
  last_updated: string;
  seller_id?: number;
  description?: { plain_text?: string };
  shipping?: {
    free_shipping?: boolean;
    mode?: string;
    dimensions?: string;
  };
}

/** Comprador dentro de una orden de MercadoLibre. */
interface MeliRawBuyer {
  id: number;
  nickname: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: { number?: string; area_code?: string };
  billing_info?: {
    doc_type?: string;
    doc_number?: string;
  };
}

/** Dirección de envío en una orden de MercadoLibre. */
interface MeliRawShippingAddress {
  receiver_name?: string;
  street_name?: string;
  street_number?: string;
  comment?: string;
  city?: { name?: string };
  state?: { name?: string; id?: string };
  country?: { name?: string; id?: string };
  zip_code?: string;
  receiver_phone?: string;
}

/** Item dentro de una orden de MercadoLibre. */
interface MeliRawOrderItem {
  item: {
    id: string;
    title: string;
    variation_id?: number;
    seller_sku?: string;
    category_id?: string;
  };
  quantity: number;
  unit_price: number;
  full_unit_price?: number;
  currency_id: string;
  sale_fee?: number;
}

/** Orden cruda de MercadoLibre. */
interface MeliRawOrder {
  id: number;
  status: string;
  status_detail?: { code?: string; description?: string } | null;
  date_created: string;
  date_last_updated: string;
  buyer: MeliRawBuyer;
  order_items: MeliRawOrderItem[];
  total_amount: number;
  currency_id: string;
  paid_amount?: number;
  shipping?: {
    id?: number;
    status?: string;
    receiver_address?: MeliRawShippingAddress;
  };
  payments?: Array<{
    id: number;
    status: string;
    status_detail?: string;
    total_paid_amount?: number;
    transaction_amount?: number;
  }>;
  tags?: string[];
  pack_id?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Productos (Items)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un item (publicación) crudo de MercadoLibre al formato unificado.
 *
 * @param raw - Item crudo de la API de MercadoLibre.
 * @returns Producto en formato unificado.
 */
export function mapMeliProduct(raw: MeliRawItem): Product {
  const currency = raw.currency_id || 'ARS';

  const statusMap: Record<string, Product['status']> = {
    active: 'active',
    paused: 'draft',
    closed: 'archived',
    under_review: 'draft',
    inactive: 'archived',
  };

  // Mapear variaciones o crear variante default
  let variants: ProductVariant[];
  if (raw.variations && raw.variations.length > 0) {
    variants = raw.variations.map((v) => mapMeliVariation(v, currency));
  } else {
    variants = [{
      id: raw.id,
      externalId: raw.id,
      title: 'Default',
      price: { amount: raw.price, currency },
      inventoryQuantity: raw.available_quantity,
      inventoryPolicy: 'deny',
      requiresShipping: raw.shipping?.mode !== 'not_specified',
      taxable: true,
    }];
  }

  const images: ProductImage[] = (raw.pictures ?? []).map((pic, index) => ({
    id: pic.id,
    src: pic.secure_url || pic.url,
    position: index,
  }));

  // Extraer tipo de producto de atributos
  const brandAttr = raw.attributes?.find((a) => a.id === 'BRAND');

  return {
    id: raw.id,
    externalId: raw.id,
    provider: 'mercadolibre',
    title: raw.title,
    description: raw.description?.plain_text,
    slug: raw.permalink?.split('/').pop() ?? raw.id,
    status: statusMap[raw.status] ?? 'draft',
    vendor: brandAttr?.value_name ?? undefined,
    productType: raw.category_id,
    tags: raw.tags ?? [],
    variants,
    images,
    createdAt: new Date(raw.date_created),
    updatedAt: new Date(raw.last_updated),
  };
}

/**
 * Transforma una variación de MercadoLibre al formato unificado.
 */
function mapMeliVariation(raw: MeliRawVariation, currency: string): ProductVariant {
  const title = (raw.attribute_combinations ?? [])
    .map((a) => a.value_name)
    .join(' / ') || 'Default';

  return {
    id: String(raw.id),
    externalId: String(raw.id),
    title,
    price: { amount: raw.price, currency },
    inventoryQuantity: raw.available_quantity,
    inventoryPolicy: 'deny',
    requiresShipping: true,
    taxable: true,
  };
}

/**
 * Transforma datos de creación de producto al formato de MercadoLibre.
 *
 * @param input - Datos de creación en formato unificado.
 * @param categoryId - ID de categoría de MercadoLibre.
 * @param siteId - Site ID de MercadoLibre (ej: 'MLA').
 * @returns Objeto con la estructura esperada por la API de MercadoLibre.
 */
export function mapProductToMeli(
  input: { title: string; description?: string; price?: number; currency?: string; quantity?: number },
  categoryId: string,
  siteId: string,
): Record<string, unknown> {
  return {
    title: input.title,
    category_id: categoryId,
    price: input.price ?? 0,
    currency_id: input.currency ?? 'ARS',
    available_quantity: input.quantity ?? 1,
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: 'new',
    description: input.description ? { plain_text: input.description } : undefined,
    site_id: siteId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Órdenes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma una orden cruda de MercadoLibre al formato unificado.
 *
 * @param raw - Orden cruda de la API de MercadoLibre.
 * @returns Orden en formato unificado.
 */
export function mapMeliOrder(raw: MeliRawOrder): Order {
  const currency = raw.currency_id || 'ARS';

  const statusMap: Record<string, Order['status']> = {
    confirmed: 'processing',
    payment_required: 'pending',
    payment_in_process: 'pending',
    partially_paid: 'processing',
    paid: 'processing',
    cancelled: 'cancelled',
    invalid: 'cancelled',
  };

  const financialMap: Record<string, Order['financialStatus']> = {
    confirmed: 'paid',
    payment_required: 'pending',
    payment_in_process: 'pending',
    partially_paid: 'pending',
    paid: 'paid',
    cancelled: 'pending',
    invalid: 'pending',
  };

  const fulfillmentMap: Record<string, Order['fulfillmentStatus']> = {
    to_be_agreed: 'unfulfilled',
    pending: 'unfulfilled',
    handling: 'unfulfilled',
    ready_to_ship: 'unfulfilled',
    shipped: 'partial',
    delivered: 'fulfilled',
    not_delivered: 'unfulfilled',
    cancelled: 'unfulfilled',
  };

  const shippingStatus = raw.shipping?.status ?? 'pending';
  if (shippingStatus === 'delivered') {
    // Override order status if delivered
  }

  const lineItems: LineItem[] = raw.order_items.map((oi, index) => ({
    id: `${raw.id}_${index}`,
    productId: oi.item.id,
    variantId: oi.item.variation_id ? String(oi.item.variation_id) : undefined,
    title: oi.item.title,
    sku: oi.item.seller_sku,
    quantity: oi.quantity,
    price: { amount: oi.unit_price, currency },
    totalDiscount: {
      amount: oi.full_unit_price ? (oi.full_unit_price - oi.unit_price) * oi.quantity : 0,
      currency,
    },
    tax: { amount: 0, currency },
  }));

  const shippingAddress = raw.shipping?.receiver_address
    ? mapMeliAddress(raw.shipping.receiver_address)
    : undefined;

  const [firstName = '', ...lastParts] = (raw.buyer.first_name ?? raw.buyer.nickname ?? '').split(' ');
  const lastName = raw.buyer.last_name ?? lastParts.join(' ');

  const buyerPhone = raw.buyer.phone
    ? `${raw.buyer.phone.area_code ?? ''}${raw.buyer.phone.number ?? ''}`.trim() || undefined
    : undefined;

  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'mercadolibre',
    orderNumber: String(raw.id),
    status: shippingStatus === 'delivered' ? 'delivered' : (statusMap[raw.status] ?? 'pending'),
    financialStatus: financialMap[raw.status] ?? 'pending',
    fulfillmentStatus: fulfillmentMap[shippingStatus] ?? 'unfulfilled',
    customer: {
      id: String(raw.buyer.id),
      email: raw.buyer.email ?? '',
      firstName,
      lastName,
      phone: buyerPhone,
    },
    lineItems,
    shippingAddress,
    subtotal: { amount: raw.total_amount, currency },
    shippingTotal: { amount: 0, currency },
    taxTotal: { amount: 0, currency },
    discountTotal: { amount: 0, currency },
    total: { amount: raw.total_amount, currency },
    currency,
    tags: raw.tags ?? [],
    createdAt: new Date(raw.date_created),
    updatedAt: new Date(raw.date_last_updated),
  };
}

/**
 * Transforma una dirección de envío de MercadoLibre al formato unificado.
 */
function mapMeliAddress(raw: MeliRawShippingAddress): Address {
  const [firstName = '', ...lastParts] = (raw.receiver_name ?? '').split(' ');
  const lastName = lastParts.join(' ');

  return {
    firstName,
    lastName,
    address1: `${raw.street_name ?? ''} ${raw.street_number ?? ''}`.trim(),
    address2: raw.comment,
    city: raw.city?.name ?? '',
    province: raw.state?.name,
    provinceCode: raw.state?.id,
    country: raw.country?.name ?? '',
    countryCode: raw.country?.id ?? '',
    zip: raw.zip_code ?? '',
    phone: raw.receiver_phone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Clientes (desde compradores de órdenes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma datos de comprador de MercadoLibre al formato unificado de Customer.
 * MercadoLibre no tiene un endpoint público de clientes; los datos se obtienen
 * de las órdenes.
 *
 * @param buyer - Datos del comprador desde una orden.
 * @param ordersCount - Número de órdenes del comprador.
 * @param totalSpent - Total gastado.
 * @param currency - Divisa.
 * @returns Cliente en formato unificado.
 */
export function mapMeliCustomer(
  buyer: MeliRawBuyer,
  ordersCount = 0,
  totalSpent = 0,
  currency = 'ARS',
): Customer {
  const avgOrderValue = ordersCount > 0 ? totalSpent / ordersCount : 0;

  const resolveSegment = (): CustomerSegment => {
    if (ordersCount === 0) return CustomerSegment.NEW;
    if (totalSpent > 50000 && ordersCount > 10) return CustomerSegment.CHAMPION;
    if (totalSpent > 20000 || ordersCount > 5) return CustomerSegment.VIP;
    if (ordersCount >= 2) return CustomerSegment.REGULAR;
    return CustomerSegment.NEW;
  };

  const phone = buyer.phone
    ? `${buyer.phone.area_code ?? ''}${buyer.phone.number ?? ''}`.trim() || undefined
    : undefined;

  return {
    id: String(buyer.id),
    externalId: String(buyer.id),
    provider: 'mercadolibre',
    email: buyer.email ?? '',
    firstName: buyer.first_name ?? buyer.nickname ?? '',
    lastName: buyer.last_name ?? '',
    phone,
    totalOrders: ordersCount,
    totalSpent: { amount: totalSpent, currency },
    averageOrderValue: { amount: avgOrderValue, currency },
    tags: [],
    addresses: [],
    acceptsMarketing: false,
    segment: resolveSegment(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Inventario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un item de MercadoLibre en un ítem de inventario unificado.
 *
 * @param raw - Item crudo de MercadoLibre.
 * @returns Ítem de inventario en formato unificado.
 */
export function mapMeliInventory(raw: MeliRawItem): InventoryItem {
  return {
    id: raw.id,
    externalId: raw.id,
    provider: 'mercadolibre',
    sku: raw.id,
    productId: raw.id,
    productTitle: raw.title,
    quantity: raw.available_quantity,
    reserved: 0,
    available: raw.available_quantity,
    updatedAt: new Date(raw.last_updated),
  };
}
