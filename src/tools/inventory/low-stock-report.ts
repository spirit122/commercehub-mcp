/**
 * @module tools/inventory/low-stock-report
 * @description Herramienta MCP para generar un reporte de productos con stock bajo.
 * Muestra días estimados para agotamiento y sugerencias de reorden.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `inventory_low_stock` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerLowStockReport(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'inventory_low_stock',
    'Genera reporte de productos con stock bajo, días para agotarse y sugerencia de reorden',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      threshold: z.number().int().min(0).default(10).describe('Umbral de stock bajo (por defecto: 10)'),
      include_zero: z.boolean().default(true).describe('Incluir productos sin stock (por defecto: true)'),
      sort_by: z.enum(['quantity', 'days_until_stockout']).optional().default('quantity').describe('Ordenar por cantidad o días para agotarse'),
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
        const inventory = await prov.getInventory({
          maxAvailable: params.threshold,
          belowReorderPoint: true,
        });

        let items = inventory.items;

        // Filtrar según include_zero
        if (!params.include_zero) {
          items = items.filter((i) => i.available > 0);
        }

        if (items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `✅ ¡Excelente! No hay productos con stock por debajo de ${params.threshold} unidades.` }],
          };
        }

        // Calcular métricas de cada ítem (simular LowStockItem si no viene del provider)
        const enrichedItems = items.map((item) => {
          // Estimar ventas diarias basadas en el reserved como proxy
          const estimatedDailySales = Math.max(item.reserved * 0.5, 0.1);
          const daysUntilStockout = item.available > 0 ? Math.floor(item.available / estimatedDailySales) : 0;
          const suggestedReorder = Math.ceil(estimatedDailySales * 30); // Cubrir 30 días

          return { ...item, estimatedDailySales, daysUntilStockout, suggestedReorder };
        });

        // Ordenar
        if (params.sort_by === 'days_until_stockout') {
          enrichedItems.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
        } else {
          enrichedItems.sort((a, b) => a.available - b.available);
        }

        const urgencyIcon = (days: number) => {
          if (days === 0) return '🔴 AGOTADO';
          if (days <= 3) return '🔴 CRÍTICO';
          if (days <= 7) return '🟠 URGENTE';
          if (days <= 14) return '🟡 ATENCIÓN';
          return '🟢 OK';
        };

        const lines: string[] = [
          `⚠️ **Reporte de Stock Bajo** (umbral: ${params.threshold} unidades)\n`,
          `📊 ${enrichedItems.length} producto(s) requieren atención\n`,
          '| Urgencia | SKU | Producto | Disponible | Días p/ agotar | Reorden sugerido |',
          '|----------|-----|----------|------------|----------------|------------------|',
        ];

        for (const item of enrichedItems) {
          lines.push(
            `| ${urgencyIcon(item.daysUntilStockout)} | ${item.sku} | ${item.productTitle} | ${item.available} | ${item.daysUntilStockout} días | ${item.suggestedReorder} uds |`
          );
        }

        // Resumen
        const outOfStock = enrichedItems.filter((i) => i.available === 0).length;
        const critical = enrichedItems.filter((i) => i.daysUntilStockout > 0 && i.daysUntilStockout <= 7).length;

        lines.push('');
        lines.push('─'.repeat(60));
        lines.push(`📋 **Resumen:**`);
        lines.push(`  🔴 Agotados: ${outOfStock}`);
        lines.push(`  🟠 Críticos (≤7 días): ${critical}`);
        lines.push(`  📦 Total bajo stock: ${enrichedItems.length}`);
        lines.push(`\n💡 **Sugerencia:** Prioriza la reposición de los productos marcados como CRÍTICO y URGENTE.`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al generar reporte de stock bajo: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
