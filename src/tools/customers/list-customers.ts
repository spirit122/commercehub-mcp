/**
 * @module tools/customers/list-customers
 * @description Herramienta MCP para listar clientes con filtros por segmento,
 * órdenes mínimas, gasto mínimo y paginación.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `customers_list` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerListCustomers(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'customers_list',
    'Lista clientes con filtros por segmento, gasto mínimo, órdenes y paginación',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      segment: z.enum(['VIP', 'REGULAR', 'NEW', 'AT_RISK', 'LOST', 'CHAMPION']).optional().describe('Filtrar por segmento de cliente'),
      min_orders: z.number().int().min(0).optional().describe('Cantidad mínima de órdenes'),
      min_spent: z.number().min(0).optional().describe('Monto mínimo gastado'),
      page: z.number().int().positive().default(1).describe('Número de página (por defecto: 1)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Clientes por página (por defecto: 20)'),
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
        const result = await prov.listCustomers({
          segment: params.segment as any,
          minOrders: params.min_orders,
          minSpent: params.min_spent,
          page: params.page,
          limit: params.limit,
        });

        if (result.items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '👥 No se encontraron clientes con los filtros aplicados.' }],
          };
        }

        const segmentIcon = (s: string) => {
          switch (s) {
            case 'VIP': return '👑';
            case 'CHAMPION': return '🏆';
            case 'REGULAR': return '👤';
            case 'NEW': return '🆕';
            case 'AT_RISK': return '⚠️';
            case 'LOST': return '💤';
            default: return '❓';
          }
        };

        const lines: string[] = [
          `👥 **Clientes** (Página ${result.page} de ${Math.ceil(result.total / result.limit)}) — ${result.total} total\n`,
          '| # | Nombre | Email | Total Gastado | Órdenes | Segmento |',
          '|---|--------|-------|---------------|---------|----------|',
        ];

        result.items.forEach((customer, index) => {
          const num = (result.page - 1) * result.limit + index + 1;
          const name = `${customer.firstName} ${customer.lastName}`.trim();
          const spent = `${customer.totalSpent.currency} ${customer.totalSpent.amount.toFixed(2)}`;

          lines.push(
            `| ${num} | ${name} | ${customer.email} | 💰 ${spent} | ${customer.totalOrders} | ${segmentIcon(customer.segment)} ${customer.segment} |`
          );
        });

        if (result.hasMore) {
          lines.push(`\n⏩ Hay más resultados. Usa \`page: ${result.page + 1}\` para ver la siguiente página.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al listar clientes: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
