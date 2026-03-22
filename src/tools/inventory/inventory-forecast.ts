/**
 * @module tools/inventory/inventory-forecast
 * @description Herramienta MCP para generar pronósticos de inventario.
 * Calcula velocidad de venta promedio, fecha estimada de agotamiento
 * y sugerencias de reorden para uno o todos los productos.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `inventory_forecast` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerInventoryForecast(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'inventory_forecast',
    'Genera pronóstico de inventario con velocidad de venta, fecha de agotamiento y sugerencia de reorden',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      sku: z.string().optional().describe('Código SKU específico (si no se proporciona, analiza todos)'),
      days_ahead: z.number().int().min(7).max(180).default(30).describe('Días a proyectar hacia adelante (por defecto: 30)'),
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
        const filters = params.sku ? { sku: params.sku } : {};
        const inventory = await prov.getInventory(filters);

        if (inventory.items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '📦 No se encontraron productos para generar pronóstico.' }],
          };
        }

        // Obtener historial para calcular velocidad de venta
        const forecasts: Array<{
          sku: string;
          title: string;
          current: number;
          dailySales: number;
          daysUntilStockout: number;
          stockoutDate: string;
          reorderDate: string;
          reorderQty: number;
          status: 'urgent' | 'warning' | 'ok';
        }> = [];

        for (const item of inventory.items) {
          // Calcular ventas diarias usando historial
          let dailySales = 0;
          try {
            const history = await prov.getInventoryHistory(item.sku, {
              from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              to: new Date(),
            });

            const totalSold = history
              .filter((m) => m.reason === 'sold')
              .reduce((sum, m) => sum + Math.abs(m.change), 0);
            dailySales = totalSold / 30;
          } catch {
            // Fallback: usar reservados como proxy
            dailySales = Math.max(item.reserved * 0.3, 0.1);
          }

          const daysUntilStockout = dailySales > 0 ? Math.floor(item.available / dailySales) : 999;
          const stockoutDate = new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000);
          const leadTimeDays = 7; // Tiempo de entrega estimado
          const reorderDate = new Date(stockoutDate.getTime() - leadTimeDays * 24 * 60 * 60 * 1000);
          const reorderQty = Math.ceil(dailySales * (params.days_ahead + leadTimeDays));

          let status: 'urgent' | 'warning' | 'ok' = 'ok';
          if (daysUntilStockout <= 7) status = 'urgent';
          else if (daysUntilStockout <= 14) status = 'warning';

          forecasts.push({
            sku: item.sku,
            title: item.productTitle,
            current: item.available,
            dailySales: Math.round(dailySales * 100) / 100,
            daysUntilStockout,
            stockoutDate: stockoutDate.toISOString().split('T')[0],
            reorderDate: reorderDate.toISOString().split('T')[0],
            reorderQty,
            status,
          });
        }

        // Ordenar por urgencia
        forecasts.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

        const lines: string[] = [
          `📈 **Pronóstico de Inventario** (${params.days_ahead} días)\n`,
          `📊 ${forecasts.length} producto(s) analizados\n`,
        ];

        const urgent = forecasts.filter((f) => f.status === 'urgent');
        const warning = forecasts.filter((f) => f.status === 'warning');
        const ok = forecasts.filter((f) => f.status === 'ok');

        if (urgent.length > 0) {
          lines.push(`⚠️ **REQUIEREN ACCIÓN INMEDIATA (${urgent.length}):**`);
          lines.push('| SKU | Producto | Stock | Venta/día | Agotamiento | Reorden |');
          lines.push('|-----|----------|-------|-----------|-------------|---------|');
          for (const f of urgent) {
            lines.push(`| ${f.sku} | ${f.title} | ${f.current} | ${f.dailySales} | ${f.stockoutDate} | ${f.reorderQty} uds |`);
          }
          lines.push('');
        }

        if (warning.length > 0) {
          lines.push(`🟡 **ATENCIÓN PRÓXIMA (${warning.length}):**`);
          lines.push('| SKU | Producto | Stock | Venta/día | Agotamiento | Reorden |');
          lines.push('|-----|----------|-------|-----------|-------------|---------|');
          for (const f of warning) {
            lines.push(`| ${f.sku} | ${f.title} | ${f.current} | ${f.dailySales} | ${f.stockoutDate} | ${f.reorderQty} uds |`);
          }
          lines.push('');
        }

        if (ok.length > 0) {
          lines.push(`✅ **STOCK SALUDABLE (${ok.length}):**`);
          lines.push('| SKU | Producto | Stock | Venta/día | Agotamiento |');
          lines.push('|-----|----------|-------|-----------|-------------|');
          for (const f of ok) {
            lines.push(`| ${f.sku} | ${f.title} | ${f.current} | ${f.dailySales} | ${f.stockoutDate} |`);
          }
        }

        lines.push('');
        lines.push('─'.repeat(60));
        lines.push(`📋 **Resumen:** ⚠️ ${urgent.length} urgentes | 🟡 ${warning.length} atención | ✅ ${ok.length} saludables`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al generar pronóstico: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
