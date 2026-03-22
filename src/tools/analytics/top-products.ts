/**
 * @module tools/analytics/top-products
 * @description Herramienta MCP para obtener el ranking de productos más vendidos.
 * Ordena por revenue o cantidad vendida con porcentaje del total.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `analytics_top_products` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerTopProducts(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'analytics_top_products',
    'Obtiene el ranking de productos más vendidos con revenue y porcentaje del total',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      period: z.enum(['today', 'this_week', 'this_month', 'last_month', 'this_year']).default('this_month').describe('Período a analizar'),
      limit: z.number().int().min(1).max(50).default(10).describe('Cantidad de productos en el ranking (por defecto: 10)'),
      sort_by: z.enum(['revenue', 'quantity']).default('revenue').describe('Ordenar por revenue o cantidad vendida'),
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
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let from: Date;

        switch (params.period) {
          case 'today': from = today; break;
          case 'this_week': from = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000); break;
          case 'this_month': from = new Date(now.getFullYear(), now.getMonth(), 1); break;
          case 'last_month': from = new Date(now.getFullYear(), now.getMonth() - 1, 1); break;
          case 'this_year': from = new Date(now.getFullYear(), 0, 1); break;
          default: from = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const to = params.period === 'last_month'
          ? new Date(now.getFullYear(), now.getMonth(), 0)
          : now;

        const topProducts = await prov.getTopProducts({ from, to }, params.limit);

        if (topProducts.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '📊 No hay datos de productos vendidos para el período seleccionado.' }],
          };
        }

        // Ordenar según criterio
        if (params.sort_by === 'quantity') {
          topProducts.sort((a, b) => b.quantitySold - a.quantitySold);
        }

        const totalRevenue = topProducts.reduce((sum, p) => sum + p.revenue.amount, 0);
        const totalUnits = topProducts.reduce((sum, p) => sum + p.quantitySold, 0);
        const currency = topProducts[0]?.revenue.currency || 'USD';

        const positionMedals = ['🥇', '🥈', '🥉'];

        const lines: string[] = [
          `🏆 **Top ${topProducts.length} Productos — ${params.period.replace('_', ' ').toUpperCase()}**`,
          `📊 Ordenado por: ${params.sort_by === 'revenue' ? 'Revenue' : 'Cantidad vendida'}\n`,
          '| Pos | Producto | SKU | Uds. Vendidas | Revenue | % Total |',
          '|-----|----------|-----|---------------|---------|---------|',
        ];

        topProducts.forEach((product, index) => {
          const medal = positionMedals[index] || `${index + 1}.`;
          const revenuePercent = totalRevenue > 0 ? ((product.revenue.amount / totalRevenue) * 100).toFixed(1) : '0.0';
          const sku = product.sku || '—';

          lines.push(
            `| ${medal} | ${product.title} | ${sku} | ${product.quantitySold} | ${currency} ${product.revenue.amount.toFixed(2)} | ${revenuePercent}% |`
          );
        });

        // Resumen
        lines.push('');
        lines.push('─'.repeat(60));
        lines.push(`📊 **Resumen del Top ${topProducts.length}:**`);
        lines.push(`  💰 Revenue total: ${currency} ${totalRevenue.toFixed(2)}`);
        lines.push(`  📦 Unidades vendidas: ${totalUnits}`);
        lines.push(`  🧾 Revenue promedio/producto: ${currency} ${(totalRevenue / topProducts.length).toFixed(2)}`);

        // Gráfico de barras horizontal
        lines.push('');
        lines.push('📊 **Distribución de Revenue (Top 5):**');
        const top5 = topProducts.slice(0, 5);
        const maxRevenue = top5[0]?.revenue.amount || 1;
        for (const p of top5) {
          const barLen = Math.max(1, Math.round((p.revenue.amount / maxRevenue) * 20));
          const bar = '█'.repeat(barLen);
          const shortTitle = p.title.length > 20 ? p.title.substring(0, 17) + '...' : p.title.padEnd(20);
          lines.push(`  ${shortTitle} ${bar} ${currency} ${p.revenue.amount.toFixed(2)}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al obtener top productos: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
