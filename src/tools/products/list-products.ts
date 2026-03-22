/**
 * @module tools/products/list-products
 * @description Herramienta MCP para listar productos de una plataforma de e-commerce.
 * Soporta filtros por estado, colección, vendedor y paginación.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `products_list` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerListProducts(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_list',
    'Lista productos de una plataforma de e-commerce con filtros y paginación',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      status: z.enum(['active', 'draft', 'archived']).optional().describe('Filtrar por estado del producto'),
      collection: z.string().optional().describe('Filtrar por colección o categoría'),
      vendor: z.string().optional().describe('Filtrar por vendedor o marca'),
      page: z.number().int().positive().default(1).describe('Número de página (por defecto: 1)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Productos por página (por defecto: 20, máximo: 100)'),
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
        const result = await prov.listProducts({
          status: params.status,
          collection: params.collection,
          vendor: params.vendor,
          page: params.page,
          limit: params.limit,
        });

        if (result.items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '📦 No se encontraron productos con los filtros aplicados.' }],
          };
        }

        const statusIcon = (s: string) => {
          switch (s) {
            case 'active': return '✅';
            case 'draft': return '📝';
            case 'archived': return '📁';
            default: return '❓';
          }
        };

        const lines: string[] = [
          `📦 **Productos** (Página ${result.page} de ${Math.ceil(result.total / result.limit)}) — ${result.total} total\n`,
          '| # | ID | Título | Precio | Stock | Estado |',
          '|---|-----|--------|--------|-------|--------|',
        ];

        result.items.forEach((product, index) => {
          const mainVariant = product.variants[0];
          const price = mainVariant ? `${mainVariant.price.currency} ${mainVariant.price.amount.toFixed(2)}` : 'N/A';
          const stock = mainVariant ? mainVariant.inventoryQuantity.toString() : 'N/A';
          const num = (result.page - 1) * result.limit + index + 1;

          lines.push(
            `| ${num} | ${product.id} | ${product.title} | 💰 ${price} | ${stock} | ${statusIcon(product.status)} ${product.status} |`
          );
        });

        if (result.hasMore) {
          lines.push(`\n⏩ Hay más resultados. Usa \`page: ${result.page + 1}\` para ver la siguiente página.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al listar productos: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
