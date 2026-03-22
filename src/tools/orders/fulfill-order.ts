/**
 * @module tools/orders/fulfill-order
 * @description Herramienta MCP para registrar el cumplimiento (fulfillment) de una orden.
 * Permite agregar información de tracking y notificar al cliente.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `orders_fulfill` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerFulfillOrder(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'orders_fulfill',
    'Registra el cumplimiento (envío) de una orden con información de tracking',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      order_id: z.string().min(1).describe('Identificador de la orden a cumplir'),
      tracking_number: z.string().optional().describe('Número de seguimiento del envío'),
      tracking_company: z.string().optional().describe('Empresa de transporte (ej: FedEx, DHL, Correo Argentino)'),
      tracking_url: z.string().url().optional().describe('URL de seguimiento del envío'),
      notify_customer: z.boolean().default(true).describe('Notificar al cliente por email (por defecto: true)'),
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
        const order = await prov.fulfillOrder({
          orderId: params.order_id,
          trackingNumber: params.tracking_number,
          trackingCompany: params.tracking_company,
          trackingUrl: params.tracking_url,
          notifyCustomer: params.notify_customer,
        });

        const lines: string[] = [
          `✅ **Orden cumplida (fulfilled) exitosamente**`,
          ``,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| Orden | ${order.orderNumber} |`,
          `| ID | ${order.id} |`,
          `| Estado | 🚚 ${order.status} |`,
          `| Cumplimiento | 📦 ${order.fulfillmentStatus} |`,
          `| Cliente | ${order.customer.firstName} ${order.customer.lastName} |`,
        ];

        if (params.tracking_number) {
          lines.push(``, `## 🚚 Información de seguimiento`);
          lines.push(`| Campo | Valor |`);
          lines.push(`|-------|-------|`);
          lines.push(`| Número de tracking | ${params.tracking_number} |`);
          if (params.tracking_company) lines.push(`| Empresa de transporte | ${params.tracking_company} |`);
          if (params.tracking_url) lines.push(`| URL de seguimiento | ${params.tracking_url} |`);
        }

        if (params.notify_customer) {
          lines.push(``, `📧 Se notificó al cliente (${order.customer.email}) sobre el envío.`);
        } else {
          lines.push(``, `⚠️ No se envió notificación al cliente.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al cumplir orden: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
