/**
 * @module providers/stripe/mapper
 * @description Funciones de mapeo entre el formato de la API de Stripe
 * y el formato unificado de CommerceHub. Stripe maneja productos, precios,
 * payment intents, clientes y suscripciones.
 */

import type {
  Product,
  ProductVariant,
  Order,
  LineItem,
  Customer,
} from '../../types/index.js';
import { CustomerSegment } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos auxiliares para respuestas crudas de Stripe
// ─────────────────────────────────────────────────────────────────────────────

/** Precio crudo de Stripe. */
interface StripeRawPrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring?: { interval: string; interval_count: number } | null;
  active: boolean;
  nickname?: string | null;
  product: string;
  type: string;
}

/** Producto crudo de Stripe. */
interface StripeRawProduct {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  images?: string[];
  metadata?: Record<string, string>;
  created: number;
  updated: number;
  default_price?: string | StripeRawPrice | null;
  url?: string | null;
}

/** Payment Intent crudo de Stripe. */
interface StripeRawPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer?: string | null;
  description?: string | null;
  metadata?: Record<string, string>;
  created: number;
  charges?: {
    data: Array<{
      id: string;
      amount_refunded: number;
      billing_details: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: {
          line1?: string | null;
          line2?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          postal_code?: string | null;
        } | null;
      };
    }>;
  };
  shipping?: {
    name?: string;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      postal_code?: string | null;
    } | null;
  } | null;
}

/** Cliente crudo de Stripe. */
interface StripeRawCustomer {
  id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  description?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
  } | null;
  metadata?: Record<string, string>;
  created: number;
  currency?: string | null;
  balance?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Productos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un producto crudo de Stripe al formato unificado.
 *
 * @param raw - Producto crudo de la API de Stripe.
 * @param prices - Lista de precios asociados al producto.
 * @returns Producto en formato unificado.
 */
export function mapStripeProduct(raw: StripeRawProduct, prices?: StripeRawPrice[]): Product {
  const variants: ProductVariant[] = [];

  if (prices && prices.length > 0) {
    for (const price of prices) {
      variants.push({
        id: price.id,
        externalId: price.id,
        title: price.nickname ?? (price.recurring ? `${price.recurring.interval}ly` : 'Default'),
        price: {
          amount: (price.unit_amount ?? 0) / 100,
          currency: price.currency.toUpperCase(),
        },
        inventoryQuantity: 0,
        inventoryPolicy: 'continue',
        requiresShipping: false,
        taxable: true,
      });
    }
  } else {
    variants.push({
      id: raw.id,
      externalId: raw.id,
      title: 'Default',
      price: { amount: 0, currency: 'USD' },
      inventoryQuantity: 0,
      inventoryPolicy: 'continue',
      requiresShipping: false,
      taxable: true,
    });
  }

  const images = (raw.images ?? []).map((src, index) => ({
    id: `img_${index}`,
    src,
    position: index,
  }));

  return {
    id: raw.id,
    externalId: raw.id,
    provider: 'stripe',
    title: raw.name,
    description: raw.description ?? undefined,
    slug: raw.id,
    status: raw.active ? 'active' : 'archived',
    tags: raw.metadata ? Object.values(raw.metadata) : [],
    variants,
    images,
    createdAt: new Date(raw.created * 1000),
    updatedAt: new Date(raw.updated * 1000),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Órdenes (Payment Intents)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un Payment Intent de Stripe al formato de orden unificado.
 *
 * @param raw - Payment Intent crudo de la API de Stripe.
 * @returns Orden en formato unificado.
 */
export function mapStripePaymentIntent(raw: StripeRawPaymentIntent): Order {
  const currency = raw.currency.toUpperCase();
  const amount = raw.amount / 100;

  const statusMap: Record<string, Order['status']> = {
    succeeded: 'delivered',
    processing: 'processing',
    requires_payment_method: 'pending',
    requires_confirmation: 'pending',
    requires_action: 'pending',
    canceled: 'cancelled',
    requires_capture: 'processing',
  };

  const financialMap: Record<string, Order['financialStatus']> = {
    succeeded: 'paid',
    processing: 'pending',
    canceled: 'pending',
    requires_payment_method: 'pending',
    requires_confirmation: 'pending',
    requires_action: 'pending',
    requires_capture: 'pending',
  };

  const charge = raw.charges?.data[0];
  const refundedAmount = charge ? charge.amount_refunded / 100 : 0;
  const billing = charge?.billing_details;

  const lineItems: LineItem[] = [{
    id: raw.id,
    productId: raw.metadata?.product_id ?? raw.id,
    title: raw.description ?? 'Payment',
    quantity: 1,
    price: { amount, currency },
    totalDiscount: { amount: 0, currency },
    tax: { amount: 0, currency },
  }];

  const [firstName = '', ...lastParts] = (billing?.name ?? '').split(' ');
  const lastName = lastParts.join(' ');

  return {
    id: raw.id,
    externalId: raw.id,
    provider: 'stripe',
    orderNumber: raw.id,
    status: statusMap[raw.status] ?? 'pending',
    financialStatus: refundedAmount > 0
      ? (refundedAmount >= amount ? 'refunded' : 'partially_refunded')
      : (financialMap[raw.status] ?? 'pending'),
    fulfillmentStatus: raw.status === 'succeeded' ? 'fulfilled' : 'unfulfilled',
    customer: {
      id: raw.customer ?? '',
      email: billing?.email ?? '',
      firstName,
      lastName,
      phone: billing?.phone ?? undefined,
    },
    lineItems,
    billingAddress: billing?.address ? {
      firstName,
      lastName,
      address1: billing.address.line1 ?? '',
      address2: billing.address.line2 ?? undefined,
      city: billing.address.city ?? '',
      province: billing.address.state ?? undefined,
      country: billing.address.country ?? '',
      countryCode: billing.address.country ?? '',
      zip: billing.address.postal_code ?? '',
    } : undefined,
    shippingAddress: raw.shipping?.address ? {
      firstName: raw.shipping.name?.split(' ')[0] ?? '',
      lastName: raw.shipping.name?.split(' ').slice(1).join(' ') ?? '',
      address1: raw.shipping.address.line1 ?? '',
      address2: raw.shipping.address.line2 ?? undefined,
      city: raw.shipping.address.city ?? '',
      province: raw.shipping.address.state ?? undefined,
      country: raw.shipping.address.country ?? '',
      countryCode: raw.shipping.address.country ?? '',
      zip: raw.shipping.address.postal_code ?? '',
    } : undefined,
    subtotal: { amount, currency },
    shippingTotal: { amount: 0, currency },
    taxTotal: { amount: 0, currency },
    discountTotal: { amount: 0, currency },
    total: { amount, currency },
    currency,
    tags: [],
    createdAt: new Date(raw.created * 1000),
    updatedAt: new Date(raw.created * 1000),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de Clientes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforma un cliente crudo de Stripe al formato unificado.
 *
 * @param raw - Cliente crudo de la API de Stripe.
 * @param ordersCount - Número de órdenes (calculado externamente).
 * @param totalSpent - Total gastado (calculado externamente).
 * @returns Cliente en formato unificado.
 */
export function mapStripeCustomer(
  raw: StripeRawCustomer,
  ordersCount = 0,
  totalSpent = 0,
): Customer {
  const [firstName = '', ...lastParts] = (raw.name ?? '').split(' ');
  const lastName = lastParts.join(' ');
  const currency = (raw.currency ?? 'usd').toUpperCase();
  const avgOrderValue = ordersCount > 0 ? totalSpent / ordersCount : 0;

  const resolveSegment = (): CustomerSegment => {
    if (ordersCount === 0) return CustomerSegment.NEW;
    if (totalSpent > 1000 && ordersCount > 10) return CustomerSegment.CHAMPION;
    if (totalSpent > 500 || ordersCount > 5) return CustomerSegment.VIP;
    if (ordersCount >= 2) return CustomerSegment.REGULAR;
    return CustomerSegment.NEW;
  };

  return {
    id: raw.id,
    externalId: raw.id,
    provider: 'stripe',
    email: raw.email ?? '',
    firstName,
    lastName,
    phone: raw.phone ?? undefined,
    totalOrders: ordersCount,
    totalSpent: { amount: totalSpent, currency },
    averageOrderValue: { amount: avgOrderValue, currency },
    tags: raw.metadata ? Object.entries(raw.metadata).map(([k, v]) => `${k}:${v}`) : [],
    addresses: raw.address ? [{
      firstName,
      lastName,
      address1: raw.address.line1 ?? '',
      address2: raw.address.line2 ?? undefined,
      city: raw.address.city ?? '',
      province: raw.address.state ?? undefined,
      country: raw.address.country ?? '',
      countryCode: raw.address.country ?? '',
      zip: raw.address.postal_code ?? '',
    }] : [],
    acceptsMarketing: false,
    segment: resolveSegment(),
    createdAt: new Date(raw.created * 1000),
    updatedAt: new Date(raw.created * 1000),
  };
}
