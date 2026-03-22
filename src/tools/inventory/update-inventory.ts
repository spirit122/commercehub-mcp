/**
 * @module tools/inventory/update-inventory
 * @description Herramienta MCP para actualizar el inventario de un producto individual.
 * Permite ajustar stock con motivo de trazabilidad y muestra el cambio anterior → nuevo.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `inventory_update` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerUpdateInventory(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'inventory_update',
    'Actualiza el inventario de un producto con motivo de ajuste y trazabilidad',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      sku: z.string().optional().describe('Código SKU del producto/variante'),
      product_id: z.string().optional().describe('Identificador del producto (alternativa a SKU)'),
      quantity: z.number().int().describe('Nueva cantidad o ajuste de inventario'),
      reason: z.enum(['received', 'sold', 'returned', 'adjustment', 'damaged', 'manual']).describe('Motivo del ajuste de inventario'),
    },
    async (params) => {
      const prov = providers.get(params.provider);
      if (!prov) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error: Proveedor "${params.provider}" no configurado.` }],
          isError: true,
        };
      }

      if (!params.sku && !params.product_id) {
        return {
          content: [{ type: 'text' as const, text: '❌ Error: Debe proporcionar al menos un `sku` o `product_id`.' }],
          isError: true,
        };
      }

      try {
        // Obtener stock anterior para mostrar el cambio
        const filters = params.sku ? { sku: params.sku } : { productId: params.product_id };
        const before = await prov.getInventory(filters);
        const previousQty = before.items.length > 0 ? before.items[0].quantity : null;

        const updated = await prov.updateInventory({
          sku: params.sku,
          productId: params.product_id,
          quantity: params.quantity,
          reason: params.reason,
        });

        const reasonLabels: Record<string, string> = {
          received: '📥 Mercadería recibida',
          sold: '🛒 Venta realizada',
          returned: '↩️ Devolución',
          adjustment: '🔧 Ajuste por conteo',
          damaged: '💔 Mercadería dañada',
          manual: '✏️ Ajuste manual',
        };

        const lines: string[] = [
          '✅ **Inventario actualizado correctamente**\n',
          `📦 **Producto:** ${updated.productTitle}${updated.variantTitle ? ` (${updated.variantTitle})` : ''}`,
          `🏷️ **SKU:** ${updated.sku}`,
          `📝 **Motivo:** ${reasonLabels[params.reason] || params.reason}`,
          '',
          '| Métrica | Antes | Después | Cambio |',
          '|---------|-------|---------|--------|',
        ];

        if (previousQty !== null) {
          const change = updated.quantity - previousQty;
          const changeStr = change >= 0 ? `+${change}` : `${change}`;
          const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
          lines.push(`| Stock total | ${previousQty} | ${updated.quantity} | ${changeIcon} ${changeStr} |`);
        } else {
          lines.push(`| Stock total | — | ${updated.quantity} | — |`);
        }

        lines.push(`| Reservado | — | ${updated.reserved} | — |`);
        lines.push(`| Disponible | — | ${updated.available} | — |`);

        if (updated.location) {
          lines.push(`\n📍 **Ubicación:** ${updated.location}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al actualizar inventario: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
