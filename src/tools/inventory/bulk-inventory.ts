/**
 * @module tools/inventory/bulk-inventory
 * @description Herramienta MCP para actualizar inventario de múltiples productos en lote.
 * Recibe un array de actualizaciones y retorna un resumen de exitosos y fallidos.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `inventory_bulk` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerBulkInventory(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'inventory_bulk',
    'Actualiza inventario de múltiples productos en lote con resumen de resultados',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      updates: z.array(z.object({
        sku: z.string().describe('Código SKU del producto/variante'),
        quantity: z.number().int().describe('Nueva cantidad o ajuste'),
        reason: z.enum(['received', 'sold', 'returned', 'adjustment', 'damaged', 'manual']).optional().default('manual').describe('Motivo del ajuste'),
      })).min(1).max(100).describe('Array de actualizaciones de inventario (máximo 100)'),
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
        const inventoryUpdates = params.updates.map((u) => ({
          sku: u.sku,
          quantity: u.quantity,
          reason: u.reason as 'received' | 'sold' | 'returned' | 'adjustment' | 'damaged' | 'manual',
        }));

        const results = await prov.bulkUpdateInventory(inventoryUpdates);

        const successful = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);

        const lines: string[] = [
          `📦 **Actualización masiva de inventario**\n`,
          `📊 **Resumen:** ${successful.length} exitosos | ${failed.length} fallidos | ${results.length} total\n`,
        ];

        // Barra de progreso visual
        const successRate = results.length > 0 ? Math.round((successful.length / results.length) * 100) : 0;
        const barLength = 20;
        const filledLength = Math.round((successRate / 100) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        lines.push(`[${bar}] ${successRate}% éxito\n`);

        if (successful.length > 0) {
          lines.push('✅ **Actualizaciones exitosas:**');
          lines.push('| SKU | Producto | Nuevo Stock | Disponible |');
          lines.push('|-----|----------|-------------|------------|');
          for (const r of successful) {
            if (r.data) {
              lines.push(`| ${r.data.sku} | ${r.data.productTitle} | ${r.data.quantity} | ${r.data.available} |`);
            }
          }
          lines.push('');
        }

        if (failed.length > 0) {
          lines.push('❌ **Actualizaciones fallidas:**');
          lines.push('| SKU | Error |');
          lines.push('|-----|-------|');
          for (let i = 0; i < results.length; i++) {
            if (!results[i].success) {
              lines.push(`| ${params.updates[i].sku} | ${results[i].error || 'Error desconocido'} |`);
            }
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error en actualización masiva: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
