/**
 * @module tools/orders/get-order
 * @description Herramienta MCP para obtener el detalle completo de una orden,
 * incluyendo líneas de pedido, direcciones, información de pago y timeline.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `orders_get` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerGetOrder(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'orders_get',
    'Obtiene el detalle completo de una orden: líneas de pedido, direcciones, pagos y timeline',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      order_id: z.string().min(1).describe('Identificador de la orden'),
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
        const order = await prov.getOrder(params.order_id);

        const statusIcon = (s: string) => {
          switch (s) {
            case 'pending': return '⏳';
            case 'processing': return '🔄';
            case 'shipped': return '🚚';
            case 'delivered': return '✅';
            case 'cancelled': return '❌';
            case 'refunded': return '💸';
            default: return '❓';
          }
        };

        const lines: string[] = [
          `📋 **Orden ${order.orderNumber}**`,
          ``,
          `## Información general`,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| ID | ${order.id} |`,
          `| ID externo | ${order.externalId} |`,
          `| Número | ${order.orderNumber} |`,
          `| Estado | ${statusIcon(order.status)} ${order.status} |`,
          `| Estado financiero | 💰 ${order.financialStatus} |`,
          `| Cumplimiento | 📦 ${order.fulfillmentStatus} |`,
          `| Creada | ${new Date(order.createdAt).toLocaleString('es')} |`,
          `| Actualizada | ${new Date(order.updatedAt).toLocaleString('es')} |`,
        ];

        if (order.note) lines.push(`| Nota | ${order.note} |`);
        if (order.tags.length > 0) lines.push(`| Tags | ${order.tags.join(', ')} |`);

        // Cliente
        lines.push(
          ``,
          `## 👤 Cliente`,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| Nombre | ${order.customer.firstName} ${order.customer.lastName} |`,
          `| Email | ${order.customer.email} |`,
        );
        if (order.customer.phone) lines.push(`| Teléfono | ${order.customer.phone} |`);

        // Líneas de pedido
        if (order.lineItems.length > 0) {
          lines.push(
            ``,
            `## 🛒 Líneas de pedido (${order.lineItems.length})`,
            `| Producto | SKU | Cantidad | Precio unit. | Descuento | Impuesto |`,
            `|----------|-----|----------|-------------|-----------|----------|`,
          );

          for (const item of order.lineItems) {
            lines.push(
              `| ${item.title} | ${item.sku || 'N/A'} | ${item.quantity} | ${item.price.currency} ${item.price.amount.toFixed(2)} | ${item.totalDiscount.amount.toFixed(2)} | ${item.tax.amount.toFixed(2)} |`
            );
          }
        }

        // Resumen financiero
        lines.push(
          ``,
          `## 💰 Resumen financiero`,
          `| Concepto | Monto |`,
          `|----------|-------|`,
          `| Subtotal | ${order.subtotal.currency} ${order.subtotal.amount.toFixed(2)} |`,
          `| Envío | ${order.shippingTotal.currency} ${order.shippingTotal.amount.toFixed(2)} |`,
          `| Impuestos | ${order.taxTotal.currency} ${order.taxTotal.amount.toFixed(2)} |`,
          `| Descuentos | -${order.discountTotal.currency} ${order.discountTotal.amount.toFixed(2)} |`,
          `| **Total** | **${order.total.currency} ${order.total.amount.toFixed(2)}** |`,
        );

        // Dirección de envío
        const formatAddress = (addr: typeof order.shippingAddress) => {
          if (!addr) return null;
          const parts = [
            `${addr.firstName} ${addr.lastName}`,
            addr.company,
            addr.address1,
            addr.address2,
            `${addr.city}${addr.province ? `, ${addr.province}` : ''} ${addr.zip}`,
            `${addr.country} (${addr.countryCode})`,
            addr.phone ? `Tel: ${addr.phone}` : null,
          ].filter(Boolean);
          return parts.join('\n');
        };

        if (order.shippingAddress) {
          lines.push(``, `## 🚚 Dirección de envío`, '```', formatAddress(order.shippingAddress) || '', '```');
        }

        if (order.billingAddress) {
          lines.push(``, `## 🏦 Dirección de facturación`, '```', formatAddress(order.billingAddress) || '', '```');
        }

        // Timeline
        try {
          const timeline = await prov.getOrderTimeline(params.order_id);
          if (timeline.length > 0) {
            lines.push(``, `## 📅 Timeline de eventos`);
            for (const event of timeline) {
              const date = new Date(event.createdAt).toLocaleString('es');
              lines.push(`- **${date}** — ${event.message} (${event.type})`);
            }
          }
        } catch {
          // Timeline es opcional; si falla, continuamos sin ella
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al obtener orden: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
