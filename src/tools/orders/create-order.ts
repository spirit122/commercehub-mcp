/**
 * @module tools/orders/create-order
 * @description Herramienta MCP para crear una nueva orden en una plataforma de e-commerce.
 * Recibe email del cliente, líneas de pedido y dirección de envío.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider, Address, LineItem } from '../../types/index.js';

/**
 * Registra la herramienta `orders_create` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerCreateOrder(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'orders_create',
    'Crea una nueva orden con email del cliente, productos y dirección de envío',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      customer_email: z.string().email().describe('Email del cliente'),
      line_items: z.string().describe('JSON array de productos: [{"product_id": "xxx", "quantity": 2}] o [{"sku": "ABC", "quantity": 1}]'),
      shipping_address: z.string().describe('JSON de dirección de envío: {"firstName", "lastName", "address1", "city", "country", "countryCode", "zip"}'),
      note: z.string().optional().describe('Nota interna para la orden'),
      send_receipt: z.boolean().default(false).describe('Enviar recibo por email al cliente (por defecto: false)'),
    },
    async (params) => {
      const prov = providers.get(params.provider);
      if (!prov) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error: Proveedor "${params.provider}" no configurado.` }],
          isError: true,
        };
      }

      try {
        // Parsear line items
        let lineItems: Array<{ product_id?: string; sku?: string; quantity: number }>;
        try {
          lineItems = JSON.parse(params.line_items);
          if (!Array.isArray(lineItems)) throw new Error('line_items debe ser un array JSON');
          if (lineItems.length === 0) throw new Error('Se requiere al menos un producto');
        } catch (parseErr) {
          return {
            content: [{ type: 'text' as const, text: `❌ Error al parsear line_items: ${parseErr instanceof Error ? parseErr.message : 'JSON inválido'}` }],
            isError: true,
          };
        }

        // Parsear dirección de envío
        let shippingAddress: Address;
        try {
          const raw = JSON.parse(params.shipping_address);
          if (!raw.firstName || !raw.lastName || !raw.address1 || !raw.city || !raw.country || !raw.countryCode || !raw.zip) {
            throw new Error('Campos requeridos: firstName, lastName, address1, city, country, countryCode, zip');
          }
          shippingAddress = {
            firstName: String(raw.firstName),
            lastName: String(raw.lastName),
            company: raw.company ? String(raw.company) : undefined,
            address1: String(raw.address1),
            address2: raw.address2 ? String(raw.address2) : undefined,
            city: String(raw.city),
            province: raw.province ? String(raw.province) : undefined,
            provinceCode: raw.provinceCode ? String(raw.provinceCode) : undefined,
            country: String(raw.country),
            countryCode: String(raw.countryCode),
            zip: String(raw.zip),
            phone: raw.phone ? String(raw.phone) : undefined,
          };
        } catch (parseErr) {
          return {
            content: [{ type: 'text' as const, text: `❌ Error al parsear shipping_address: ${parseErr instanceof Error ? parseErr.message : 'JSON inválido'}` }],
            isError: true,
          };
        }

        // Construir line items para el provider
        const mappedLineItems: Partial<LineItem>[] = lineItems.map((item) => ({
          productId: item.product_id || '',
          sku: item.sku,
          quantity: item.quantity,
          title: '',
          price: { amount: 0, currency: 'USD' },
          totalDiscount: { amount: 0, currency: 'USD' },
          tax: { amount: 0, currency: 'USD' },
        }));

        const order = await prov.createOrder({
          customer: {
            id: '',
            email: params.customer_email,
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
          },
          lineItems: mappedLineItems as LineItem[],
          shippingAddress,
          note: params.note,
          tags: params.send_receipt ? ['send_receipt'] : [],
        });

        const lines: string[] = [
          `✅ **Orden creada exitosamente**`,
          ``,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| Número de orden | ${order.orderNumber} |`,
          `| ID | ${order.id} |`,
          `| Cliente | ${order.customer.firstName} ${order.customer.lastName} |`,
          `| Email | ${order.customer.email} |`,
          `| Estado | ⏳ ${order.status} |`,
          `| Estado financiero | 💰 ${order.financialStatus} |`,
          ``,
          `## 🛒 Líneas de pedido`,
        ];

        if (order.lineItems.length > 0) {
          lines.push(
            `| Producto | Cantidad | Precio |`,
            `|----------|----------|--------|`,
          );
          for (const item of order.lineItems) {
            lines.push(`| ${item.title} | ${item.quantity} | ${item.price.currency} ${item.price.amount.toFixed(2)} |`);
          }
        }

        lines.push(
          ``,
          `## 💰 Totales`,
          `| Concepto | Monto |`,
          `|----------|-------|`,
          `| Subtotal | ${order.subtotal.currency} ${order.subtotal.amount.toFixed(2)} |`,
          `| Envío | ${order.shippingTotal.currency} ${order.shippingTotal.amount.toFixed(2)} |`,
          `| Impuestos | ${order.taxTotal.currency} ${order.taxTotal.amount.toFixed(2)} |`,
          `| **Total** | **${order.total.currency} ${order.total.amount.toFixed(2)}** |`,
        );

        lines.push(
          ``,
          `📦 Dirección de envío: ${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.country}`,
        );

        if (params.send_receipt) {
          lines.push(`\n📧 Se enviará recibo a ${params.customer_email}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al crear orden: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
