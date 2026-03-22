/**
 * @module tools/inventory/get-inventory
 * @description Herramienta MCP para consultar el inventario actual de productos.
 * Permite filtrar por SKU, ID de producto y ubicación.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `inventory_get` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerGetInventory(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'inventory_get',
    'Consulta el inventario actual de productos con stock, reservado y disponible',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      sku: z.string().optional().describe('Código SKU del producto/variante'),
      product_id: z.string().optional().describe('Identificador del producto'),
      location: z.string().optional().describe('Ubicación o almacén específico'),
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
        const result = await prov.getInventory({
          sku: params.sku,
          productId: params.product_id,
          location: params.location,
        });

        if (result.items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '📦 No se encontraron ítems de inventario con los filtros aplicados.' }],
          };
        }

        const stockIcon = (available: number, reorderPoint?: number) => {
          if (available === 0) return '🔴';
          if (reorderPoint && available <= reorderPoint) return '🟡';
          return '🟢';
        };

        const lines: string[] = [
          `📦 **Inventario** — ${result.total} ítem(s) encontrado(s)\n`,
          '| SKU | Producto | Total | Reservado | Disponible | Ubicación | Estado |',
          '|-----|----------|-------|-----------|------------|-----------|--------|',
        ];

        for (const item of result.items) {
          const icon = stockIcon(item.available, item.reorderPoint);
          const location = item.location || 'Sin asignar';
          lines.push(
            `| ${item.sku} | ${item.productTitle}${item.variantTitle ? ` (${item.variantTitle})` : ''} | ${item.quantity} | ${item.reserved} | ${item.available} | ${location} | ${icon} |`
          );
        }

        // Resumen rápido
        const totalStock = result.items.reduce((sum, i) => sum + i.quantity, 0);
        const totalReserved = result.items.reduce((sum, i) => sum + i.reserved, 0);
        const totalAvailable = result.items.reduce((sum, i) => sum + i.available, 0);

        lines.push('');
        lines.push(`📊 **Resumen:** Total: ${totalStock} | Reservado: ${totalReserved} | Disponible: ${totalAvailable}`);

        if (result.hasMore) {
          lines.push(`\n⏩ Hay más resultados disponibles.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al consultar inventario: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
