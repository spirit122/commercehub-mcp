/**
 * @module tools/orders/list-orders
 * @description Herramienta MCP para listar órdenes de una plataforma de e-commerce.
 * Soporta filtros por estado, fechas, cliente, montos y paginación.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider, OrderFilters } from '../../types/index.js';

/**
 * Registra la herramienta `orders_list` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerListOrders(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'orders_list',
    'Lista órdenes de una plataforma de e-commerce con filtros avanzados y paginación',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional().describe('Filtrar por estado general'),
      financial_status: z.enum(['pending', 'paid', 'partially_refunded', 'refunded']).optional().describe('Filtrar por estado financiero'),
      fulfillment_status: z.enum(['unfulfilled', 'partial', 'fulfilled']).optional().describe('Filtrar por estado de cumplimiento'),
      date_from: z.string().optional().describe('Fecha desde (formato ISO: YYYY-MM-DD)'),
      date_to: z.string().optional().describe('Fecha hasta (formato ISO: YYYY-MM-DD)'),
      customer_email: z.string().email().optional().describe('Filtrar por email del cliente'),
      min_total: z.number().min(0).optional().describe('Total mínimo de la orden'),
      max_total: z.number().positive().optional().describe('Total máximo de la orden'),
      page: z.number().int().positive().default(1).describe('Número de página (por defecto: 1)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Órdenes por página (por defecto: 20, máximo: 100)'),
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
        const filters: OrderFilters = {
          status: params.status,
          financialStatus: params.financial_status,
          fulfillmentStatus: params.fulfillment_status,
          customerEmail: params.customer_email,
          minTotal: params.min_total,
          maxTotal: params.max_total,
          page: params.page,
          limit: params.limit,
        };

        if (params.date_from || params.date_to) {
          filters.dateRange = {
            from: params.date_from ? new Date(params.date_from) : new Date(0),
            to: params.date_to ? new Date(params.date_to) : new Date(),
          };
        }

        const result = await prov.listOrders(filters);

        if (result.items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '📋 No se encontraron órdenes con los filtros aplicados.' }],
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
            case 'partially_refunded': return '💸';
            case 'refunded': return '🔙';
            default: return '❓';
          }
        };

        const lines: string[] = [
          `📋 **Órdenes** (Página ${result.page} de ${Math.ceil(result.total / result.limit)}) — ${result.total} total`,
          ``,
          `| # | Orden | Cliente | Total | Estado | Pago | Fecha |`,
          `|---|-------|---------|-------|--------|------|-------|`,
        ];

        result.items.forEach((order, index) => {
          const num = (result.page - 1) * result.limit + index + 1;
          const clientName = `${order.customer.firstName} ${order.customer.lastName}`;
          const total = `${order.currency} ${order.total.amount.toFixed(2)}`;
          const date = new Date(order.createdAt).toLocaleDateString('es');

          lines.push(
            `| ${num} | ${order.orderNumber} | ${clientName} | 💰 ${total} | ${statusIcon(order.status)} ${order.status} | ${financialIcon(order.financialStatus)} ${order.financialStatus} | ${date} |`
          );
        });

        // Resumen de totales
        const totalRevenue = result.items.reduce((sum, o) => sum + o.total.amount, 0);
        lines.push(
          ``,
          `**💰 Total en página:** ${result.items[0]?.currency || 'USD'} ${totalRevenue.toFixed(2)} (${result.items.length} órdenes)`,
        );

        if (result.hasMore) {
          lines.push(`\n⏩ Hay más resultados. Usa \`page: ${result.page + 1}\` para ver la siguiente página.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al listar órdenes: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
