/**
 * @module tools/analytics/sales-by-channel
 * @description Herramienta MCP para comparar ventas entre plataformas/canales.
 * Muestra revenue, órdenes y ticket promedio por cada proveedor configurado.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `analytics_by_channel` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerSalesByChannel(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'analytics_by_channel',
    'Compara ventas entre plataformas con revenue, órdenes y ticket promedio por canal',
    {
      period: z.enum(['today', 'this_week', 'this_month', 'last_month', 'this_year']).default('this_month').describe('Período a analizar'),
      providers: z.array(z.string()).optional().describe('Lista de proveedores a comparar (JSON array, si no se proporciona usa todos los configurados)'),
    },
    async (params) => {
      const providerNames = params.providers || Array.from(providers.keys());

      if (providerNames.length === 0) {
        return {
          content: [{ type: 'text' as const, text: '❌ Error: No hay proveedores configurados.' }],
          isError: true,
        };
      }

      // Validar proveedores
      const invalidProviders = providerNames.filter((p) => !providers.has(p));
      if (invalidProviders.length > 0) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error: Proveedores no configurados: ${invalidProviders.join(', ')}` }],
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

        const channelData: Array<{
          provider: string;
          revenue: number;
          orders: number;
          avgOrder: number;
          currency: string;
        }> = [];

        for (const provName of providerNames) {
          const prov = providers.get(provName)!;
          try {
            const report = await prov.getRevenue({ from, to });
            channelData.push({
              provider: provName,
              revenue: report.revenue.amount,
              orders: report.orderCount,
              avgOrder: report.averageOrderValue.amount,
              currency: report.revenue.currency,
            });
          } catch {
            channelData.push({
              provider: provName,
              revenue: 0,
              orders: 0,
              avgOrder: 0,
              currency: 'USD',
            });
          }
        }

        const totalRevenue = channelData.reduce((sum, c) => sum + c.revenue, 0);
        const totalOrders = channelData.reduce((sum, c) => sum + c.orders, 0);
        const currency = channelData[0]?.currency || 'USD';

        // Ordenar por revenue
        channelData.sort((a, b) => b.revenue - a.revenue);

        const providerIcons: Record<string, string> = {
          shopify: '🟢',
          woocommerce: '🟣',
          stripe: '🔵',
          mercadolibre: '🟡',
        };

        const lines: string[] = [
          `📊 **Ventas por Canal — ${params.period.replace('_', ' ').toUpperCase()}**\n`,
          `📅 ${from.toLocaleDateString('es-ES')} → ${to.toLocaleDateString('es-ES')}\n`,
          '| Canal | Revenue | % Revenue | Órdenes | % Órdenes | Ticket Prom. |',
          '|-------|---------|-----------|---------|-----------|--------------|',
        ];

        for (const channel of channelData) {
          const icon = providerIcons[channel.provider] || '⚪';
          const revPercent = totalRevenue > 0 ? ((channel.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
          const ordPercent = totalOrders > 0 ? ((channel.orders / totalOrders) * 100).toFixed(1) : '0.0';

          lines.push(
            `| ${icon} ${channel.provider} | ${currency} ${channel.revenue.toFixed(2)} | ${revPercent}% | ${channel.orders} | ${ordPercent}% | ${currency} ${channel.avgOrder.toFixed(2)} |`
          );
        }

        lines.push('');
        lines.push('─'.repeat(60));
        lines.push(`💰 **Total combinado:** ${currency} ${totalRevenue.toFixed(2)} | ${totalOrders} órdenes`);

        // Gráfico de distribución
        lines.push('');
        lines.push('📊 **Distribución de Revenue por Canal:**');
        for (const channel of channelData) {
          const icon = providerIcons[channel.provider] || '⚪';
          const percent = totalRevenue > 0 ? (channel.revenue / totalRevenue) * 100 : 0;
          const barLen = Math.max(0, Math.round(percent / 5));
          const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));
          lines.push(`  ${icon} ${channel.provider.padEnd(15)} [${bar}] ${percent.toFixed(1)}%`);
        }

        // Canal ganador
        if (channelData.length > 1 && channelData[0].revenue > 0) {
          lines.push('');
          lines.push(`🏆 **Canal líder:** ${providerIcons[channelData[0].provider] || ''} ${channelData[0].provider} con ${currency} ${channelData[0].revenue.toFixed(2)}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al comparar canales: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
