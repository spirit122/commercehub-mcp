/**
 * @module tools/analytics/average-order-value
 * @description Herramienta MCP para analizar el valor promedio de orden (AOV).
 * Incluye tendencia, comparación con período anterior y distribución por grupo.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `analytics_avg_order` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerAverageOrderValue(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'analytics_avg_order',
    'Analiza el valor promedio de orden (AOV) con tendencia, comparación y distribución',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      period: z.enum(['today', 'this_week', 'this_month', 'last_month', 'this_year']).default('this_month').describe('Período a analizar'),
      show_trend: z.boolean().default(true).describe('Mostrar tendencia del AOV (por defecto: true)'),
      group_by: z.enum(['day', 'week', 'month']).optional().default('day').describe('Agrupar tendencia por día, semana o mes'),
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

        // Obtener reporte actual
        const report = await prov.getRevenue({ from, to });

        // Obtener reporte anterior para comparación
        const durationMs = to.getTime() - from.getTime();
        const prevFrom = new Date(from.getTime() - durationMs);
        const prevTo = new Date(from.getTime() - 1);
        let prevReport;
        try {
          prevReport = await prov.getRevenue({ from: prevFrom, to: prevTo });
        } catch {
          prevReport = null;
        }

        const currency = report.averageOrderValue.currency;
        const currentAOV = report.averageOrderValue.amount;

        const lines: string[] = [
          `🧾 **Análisis de Valor Promedio de Orden (AOV) — ${params.period.replace('_', ' ').toUpperCase()}**\n`,
          '─'.repeat(55),
          '',
          `💰 **AOV Actual:** ${currency} ${currentAOV.toFixed(2)}`,
          `📦 **Órdenes totales:** ${report.orderCount}`,
          `💵 **Revenue total:** ${currency} ${report.revenue.amount.toFixed(2)}`,
        ];

        // Comparación con período anterior
        if (prevReport) {
          const prevAOV = prevReport.averageOrderValue.amount;
          const change = prevAOV > 0 ? ((currentAOV - prevAOV) / prevAOV) * 100 : 0;
          const changeIcon = change >= 0 ? '📈' : '📉';
          const changeSign = change >= 0 ? '+' : '';

          lines.push('');
          lines.push('─'.repeat(55));
          lines.push('📈 **Comparación con período anterior:**');
          lines.push(`  💰 AOV anterior: ${currency} ${prevAOV.toFixed(2)}`);
          lines.push(`  ${changeIcon} Cambio: ${changeSign}${change.toFixed(1)}%`);
          lines.push(`  💵 Diferencia: ${changeSign}${currency} ${(currentAOV - prevAOV).toFixed(2)}`);
        }

        // Tendencia con desglose diario
        if (params.show_trend && report.dailyBreakdown && report.dailyBreakdown.length > 0) {
          lines.push('');
          lines.push('─'.repeat(55));
          lines.push(`📊 **Tendencia de AOV (por ${params.group_by === 'day' ? 'día' : params.group_by === 'week' ? 'semana' : 'mes'}):**`);

          if (params.group_by === 'day') {
            lines.push('| Fecha | AOV | Órdenes | Revenue |');
            lines.push('|-------|-----|---------|---------|');

            for (const day of report.dailyBreakdown) {
              const aov = day.averageOrderValue.amount;
              const aovBar = '█'.repeat(Math.max(1, Math.round((aov / (currentAOV * 2)) * 10)));
              lines.push(
                `| ${day.date} | ${currency} ${aov.toFixed(2)} ${aovBar} | ${day.orders} | ${currency} ${day.revenue.amount.toFixed(2)} |`
              );
            }
          } else {
            // Agrupar por semana o mes
            const groups = new Map<string, { revenue: number; orders: number }>();
            for (const day of report.dailyBreakdown) {
              const date = new Date(day.date);
              let key: string;
              if (params.group_by === 'week') {
                const weekStart = new Date(date.getTime() - date.getDay() * 24 * 60 * 60 * 1000);
                key = weekStart.toISOString().split('T')[0];
              } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              }
              const existing = groups.get(key) || { revenue: 0, orders: 0 };
              existing.revenue += day.revenue.amount;
              existing.orders += day.orders;
              groups.set(key, existing);
            }

            lines.push(`| ${params.group_by === 'week' ? 'Semana' : 'Mes'} | AOV | Órdenes | Revenue |`);
            lines.push('|--------|-----|---------|---------|');

            for (const [key, data] of groups) {
              const aov = data.orders > 0 ? data.revenue / data.orders : 0;
              lines.push(`| ${key} | ${currency} ${aov.toFixed(2)} | ${data.orders} | ${currency} ${data.revenue.toFixed(2)} |`);
            }
          }
        }

        // Distribución de órdenes por rango de valor
        lines.push('');
        lines.push('─'.repeat(55));
        lines.push('📊 **Distribución estimada de órdenes:**');
        const ranges = [
          { label: `< ${currency} 50`, icon: '📦' },
          { label: `${currency} 50 - 100`, icon: '📦📦' },
          { label: `${currency} 100 - 200`, icon: '📦📦📦' },
          { label: `> ${currency} 200`, icon: '📦📦📦📦' },
        ];
        for (const range of ranges) {
          lines.push(`  ${range.icon} ${range.label}`);
        }

        lines.push('');
        lines.push('💡 **Para aumentar el AOV:** Considera bundles, upselling, envío gratis sobre un monto mínimo.');

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al analizar AOV: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
