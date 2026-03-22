/**
 * @module tools/customers/search-customers
 * @description Herramienta MCP para buscar clientes por texto libre.
 * Busca coincidencias en nombre, email y teléfono.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `customers_search` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerSearchCustomers(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'customers_search',
    'Busca clientes por nombre, email o teléfono',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      query: z.string().min(1).describe('Texto de búsqueda (nombre, email o teléfono)'),
      limit: z.number().int().min(1).max(50).default(10).describe('Máximo de resultados (por defecto: 10)'),
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
        const result = await prov.searchCustomers(params.query, { limit: params.limit });

        if (result.items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `🔍 No se encontraron clientes para "${params.query}".` }],
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
          `🔍 **Resultados para "${params.query}"** — ${result.total} encontrado(s)\n`,
          '| # | ID | Nombre | Email | Teléfono | Órdenes | Segmento |',
          '|---|----|--------|-------|----------|---------|----------|',
        ];

        result.items.forEach((customer, index) => {
          const name = `${customer.firstName} ${customer.lastName}`.trim();
          const phone = customer.phone || '—';

          lines.push(
            `| ${index + 1} | ${customer.id} | ${name} | ${customer.email} | ${phone} | ${customer.totalOrders} | ${segmentIcon(customer.segment)} ${customer.segment} |`
          );
        });

        if (result.hasMore) {
          lines.push(`\n⏩ Hay más resultados. Incrementa \`limit\` para ver más.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al buscar clientes: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
