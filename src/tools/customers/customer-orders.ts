/**
 * @module tools/customers/customer-orders
 * @description Herramienta MCP para obtener el historial de compras de un cliente
 * con totales y paginación.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `customers_orders` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerCustomerOrders(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'customers_orders',
    'Obtiene el historial de compras de un cliente con totales y detalles',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      customer_id: z.string().describe('Identificador del cliente'),
      page: z.number().int().positive().default(1).describe('Número de página (por defecto: 1)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Órdenes por página (por defecto: 20)'),
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
        const result = await prov.getCustomerOrders(params.customer_id, {
          page: params.page,
          limit: params.limit,
        });

        if (result.items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `📦 Este cliente no tiene órdenes registradas.` }],
          };
        }

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

        const financialIcon = (s: string) => {
          switch (s) {
            case 'paid': return '💰';
            case 'pending': return '⏳';
            case 'refunded': return '💸';
            case 'partially_refunded': return '💳';
            default: return '❓';
          }
        };

        const lines: string[] = [
          `🛍️ **Historial de Compras** (Página ${result.page} de ${Math.ceil(result.total / result.limit)}) — ${result.total} orden(es)\n`,
          '| # | Orden | Fecha | Total | Estado | Pago | Ítems |',
          '|---|-------|-------|-------|--------|------|-------|',
        ];

        let grandTotal = 0;
        const currency = result.items[0]?.total?.currency || 'USD';

        result.items.forEach((order, index) => {
          const num = (result.page - 1) * result.limit + index + 1;
          const date = new Date(order.createdAt).toLocaleDateString('es-ES');
          const total = `${order.total.currency} ${order.total.amount.toFixed(2)}`;
          const itemCount = order.lineItems?.length || 0;
          grandTotal += order.total.amount;

          lines.push(
            `| ${num} | #${order.orderNumber || order.id} | ${date} | ${total} | ${statusIcon(order.status)} ${order.status} | ${financialIcon(order.financialStatus)} ${order.financialStatus} | ${itemCount} |`
          );
        });

        lines.push('');
        lines.push('─'.repeat(60));
        lines.push(`💰 **Total en página:** ${currency} ${grandTotal.toFixed(2)}`);

        if (result.hasMore) {
          lines.push(`\n⏩ Hay más órdenes. Usa \`page: ${result.page + 1}\` para ver la siguiente página.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al obtener órdenes del cliente: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
