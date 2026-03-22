/**
 * @module tools/products/search-products
 * @description Herramienta MCP para buscar productos por texto libre con filtros opcionales
 * de precio y estado.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `products_search` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerSearchProducts(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_search',
    'Busca productos por texto libre con filtros opcionales de precio y estado',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      query: z.string().min(1).describe('Texto de búsqueda (título, descripción, SKU)'),
      min_price: z.number().min(0).optional().describe('Precio mínimo para filtrar'),
      max_price: z.number().positive().optional().describe('Precio máximo para filtrar'),
      status: z.enum(['active', 'draft', 'archived']).optional().describe('Filtrar por estado'),
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
        const result = await prov.searchProducts(params.query, { limit: params.limit });

        // Aplicar filtros adicionales en el cliente
        let filtered = result.items;

        if (params.status) {
          filtered = filtered.filter((p) => p.status === params.status);
        }

        if (params.min_price !== undefined) {
          filtered = filtered.filter((p) => {
            const price = p.variants[0]?.price.amount ?? 0;
            return price >= params.min_price!;
          });
        }

        if (params.max_price !== undefined) {
          filtered = filtered.filter((p) => {
            const price = p.variants[0]?.price.amount ?? 0;
            return price <= params.max_price!;
          });
        }

        if (filtered.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: `🔍 No se encontraron productos para la búsqueda "${params.query}" con los filtros aplicados.`,
            }],
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
          `🔍 **Resultados de búsqueda** para "${params.query}" — ${filtered.length} encontrado(s)`,
          ``,
        ];

        for (const product of filtered) {
          const mainVariant = product.variants[0];
          const price = mainVariant ? `${mainVariant.price.currency} ${mainVariant.price.amount.toFixed(2)}` : 'N/A';
          const stock = mainVariant ? mainVariant.inventoryQuantity : 0;
          const stockIcon = stock > 0 ? '✅' : '❌';

          lines.push(
            `---`,
            `**${product.title}** ${statusIcon(product.status)}`,
            `- ID: \`${product.id}\``,
            `- 💰 Precio: ${price}`,
            `- ${stockIcon} Stock: ${stock} unidades`,
            `- 🏷️ Tags: ${product.tags.length > 0 ? product.tags.join(', ') : 'ninguno'}`,
          );

          if (product.vendor) lines.push(`- 🏪 Vendedor: ${product.vendor}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al buscar productos: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
