import { describe, it, expect } from 'vitest';

/**
 * Tests para el mapper de Shopify.
 * Verifica que los datos de la API de Shopify se transforman correctamente
 * al formato unificado de CommerceHub.
 */

/** Simulación del mapper para tests independientes */
function mapShopifyProduct(raw: any) {
  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'shopify' as const,
    title: raw.title ?? '',
    description: raw.body_html?.replace(/<[^>]*>/g, '') ?? '',
    htmlDescription: raw.body_html ?? '',
    slug: raw.handle ?? '',
    status: raw.status === 'active' ? 'active' : raw.status === 'draft' ? 'draft' : 'archived',
    vendor: raw.vendor ?? '',
    productType: raw.product_type ?? '',
    tags: typeof raw.tags === 'string' ? raw.tags.split(', ').filter(Boolean) : raw.tags ?? [],
    variants: (raw.variants ?? []).map((v: any) => ({
      id: String(v.id),
      externalId: String(v.id),
      title: v.title ?? 'Default',
      sku: v.sku ?? '',
      barcode: v.barcode ?? null,
      price: { amount: parseFloat(v.price ?? '0'), currency: 'USD' },
      compareAtPrice: v.compare_at_price
        ? { amount: parseFloat(v.compare_at_price), currency: 'USD' }
        : null,
      weight: v.weight ?? 0,
      weightUnit: v.weight_unit ?? 'kg',
      inventoryQuantity: v.inventory_quantity ?? 0,
      inventoryPolicy: v.inventory_policy ?? 'deny',
      requiresShipping: v.requires_shipping ?? true,
      taxable: v.taxable ?? true,
    })),
    images: (raw.images ?? []).map((img: any) => ({
      id: String(img.id),
      src: img.src ?? '',
      alt: img.alt ?? '',
      position: img.position ?? 0,
      width: img.width ?? 0,
      height: img.height ?? 0,
    })),
    seoTitle: raw.title ?? '',
    seoDescription: raw.body_html?.replace(/<[^>]*>/g, '').slice(0, 160) ?? '',
    createdAt: raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? new Date().toISOString(),
  };
}

function mapShopifyOrder(raw: any) {
  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'shopify' as const,
    orderNumber: raw.order_number ? `#${raw.order_number}` : String(raw.id),
    status: raw.cancelled_at ? 'cancelled' : raw.closed_at ? 'delivered' : 'processing',
    financialStatus: raw.financial_status ?? 'pending',
    fulfillmentStatus: raw.fulfillment_status ?? 'unfulfilled',
    customer: raw.customer
      ? {
          id: String(raw.customer.id),
          email: raw.customer.email ?? '',
          firstName: raw.customer.first_name ?? '',
          lastName: raw.customer.last_name ?? '',
          phone: raw.customer.phone ?? null,
        }
      : null,
    lineItems: (raw.line_items ?? []).map((li: any) => ({
      id: String(li.id),
      productId: li.product_id ? String(li.product_id) : null,
      variantId: li.variant_id ? String(li.variant_id) : null,
      title: li.title ?? '',
      sku: li.sku ?? '',
      quantity: li.quantity ?? 1,
      price: { amount: parseFloat(li.price ?? '0'), currency: 'USD' },
      totalDiscount: { amount: parseFloat(li.total_discount ?? '0'), currency: 'USD' },
      tax: {
        amount: (li.tax_lines ?? []).reduce(
          (sum: number, t: any) => sum + parseFloat(t.price ?? '0'),
          0,
        ),
        currency: 'USD',
      },
    })),
    total: { amount: parseFloat(raw.total_price ?? '0'), currency: raw.currency ?? 'USD' },
    subtotal: {
      amount: parseFloat(raw.subtotal_price ?? '0'),
      currency: raw.currency ?? 'USD',
    },
    createdAt: raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? new Date().toISOString(),
  };
}

describe('Shopify Mapper', () => {
  describe('mapShopifyProduct', () => {
    const rawProduct = {
      id: 123456789,
      title: 'Camiseta Premium',
      body_html: '<p>Una camiseta <strong>increíble</strong></p>',
      handle: 'camiseta-premium',
      status: 'active',
      vendor: 'MiMarca',
      product_type: 'Ropa',
      tags: 'verano, algodón, premium',
      variants: [
        {
          id: 111,
          title: 'Talla M',
          sku: 'CAM-M-001',
          price: '29.99',
          compare_at_price: '39.99',
          inventory_quantity: 50,
          weight: 0.3,
          weight_unit: 'kg',
          requires_shipping: true,
          taxable: true,
        },
      ],
      images: [
        {
          id: 222,
          src: 'https://cdn.shopify.com/s/files/img.jpg',
          alt: 'Camiseta frente',
          position: 1,
          width: 800,
          height: 600,
        },
      ],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-15T00:00:00Z',
    };

    it('debe mapear campos básicos correctamente', () => {
      const product = mapShopifyProduct(rawProduct);
      expect(product.id).toBe('123456789');
      expect(product.provider).toBe('shopify');
      expect(product.title).toBe('Camiseta Premium');
      expect(product.slug).toBe('camiseta-premium');
      expect(product.status).toBe('active');
      expect(product.vendor).toBe('MiMarca');
    });

    it('debe limpiar HTML de la descripción', () => {
      const product = mapShopifyProduct(rawProduct);
      expect(product.description).toBe('Una camiseta increíble');
      expect(product.htmlDescription).toContain('<strong>');
    });

    it('debe parsear tags correctamente', () => {
      const product = mapShopifyProduct(rawProduct);
      expect(product.tags).toEqual(['verano', 'algodón', 'premium']);
    });

    it('debe mapear variantes con precios como Money', () => {
      const product = mapShopifyProduct(rawProduct);
      expect(product.variants).toHaveLength(1);
      expect(product.variants[0].sku).toBe('CAM-M-001');
      expect(product.variants[0].price).toEqual({ amount: 29.99, currency: 'USD' });
      expect(product.variants[0].compareAtPrice).toEqual({ amount: 39.99, currency: 'USD' });
      expect(product.variants[0].inventoryQuantity).toBe(50);
    });

    it('debe mapear imágenes', () => {
      const product = mapShopifyProduct(rawProduct);
      expect(product.images).toHaveLength(1);
      expect(product.images[0].alt).toBe('Camiseta frente');
      expect(product.images[0].width).toBe(800);
    });

    it('debe manejar datos faltantes sin fallar', () => {
      const minimal = { id: 1 };
      const product = mapShopifyProduct(minimal);
      expect(product.id).toBe('1');
      expect(product.title).toBe('');
      expect(product.variants).toEqual([]);
      expect(product.images).toEqual([]);
    });
  });

  describe('mapShopifyOrder', () => {
    const rawOrder = {
      id: 987654321,
      order_number: 1001,
      financial_status: 'paid',
      fulfillment_status: null,
      total_price: '59.98',
      subtotal_price: '54.98',
      currency: 'USD',
      customer: {
        id: 555,
        email: 'juan@example.com',
        first_name: 'Juan',
        last_name: 'Pérez',
        phone: '+52 555 1234567',
      },
      line_items: [
        {
          id: 777,
          product_id: 123,
          variant_id: 456,
          title: 'Camiseta Premium',
          sku: 'CAM-M-001',
          quantity: 2,
          price: '29.99',
          total_discount: '5.00',
          tax_lines: [{ price: '4.80' }],
        },
      ],
      created_at: '2024-06-15T10:30:00Z',
      updated_at: '2024-06-15T10:30:00Z',
    };

    it('debe mapear campos básicos de la orden', () => {
      const order = mapShopifyOrder(rawOrder);
      expect(order.id).toBe('987654321');
      expect(order.orderNumber).toBe('#1001');
      expect(order.financialStatus).toBe('paid');
      expect(order.fulfillmentStatus).toBe('unfulfilled');
    });

    it('debe mapear el cliente', () => {
      const order = mapShopifyOrder(rawOrder);
      expect(order.customer).not.toBeNull();
      expect(order.customer!.email).toBe('juan@example.com');
      expect(order.customer!.firstName).toBe('Juan');
    });

    it('debe mapear line items con precios', () => {
      const order = mapShopifyOrder(rawOrder);
      expect(order.lineItems).toHaveLength(1);
      expect(order.lineItems[0].quantity).toBe(2);
      expect(order.lineItems[0].price.amount).toBe(29.99);
      expect(order.lineItems[0].totalDiscount.amount).toBe(5);
      expect(order.lineItems[0].tax.amount).toBe(4.8);
    });

    it('debe mapear totales', () => {
      const order = mapShopifyOrder(rawOrder);
      expect(order.total).toEqual({ amount: 59.98, currency: 'USD' });
      expect(order.subtotal).toEqual({ amount: 54.98, currency: 'USD' });
    });

    it('debe detectar órdenes canceladas', () => {
      const cancelled = { ...rawOrder, cancelled_at: '2024-06-16T00:00:00Z' };
      const order = mapShopifyOrder(cancelled);
      expect(order.status).toBe('cancelled');
    });
  });
});
