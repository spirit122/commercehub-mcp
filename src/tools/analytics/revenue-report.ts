/**
 * @module tools/analytics/revenue-report
 * @description Herramienta MCP para generar reportes de ingresos con comparación
 * de período anterior, desglose diario y métricas clave.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Calcula el rango de fechas para un período predefinido.
 *
 * @param period - Nombre del período.
 * @param dateFrom - Fecha inicio personalizada.
 * @param dateTo - Fecha fin personalizada.
 * @returns Rango de fechas actual y del período anterior.
 */
function getDateRanges(period: string, dateFrom?: string, dateTo?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date;
  let to: Date;

  switch (period) {
    case 'today':
      from = today;
      to = now;
      break;
    case 'yesterday':
      from = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      to = new Date(today.getTime() - 1);
      break;
    case 'this_week':
      from = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
      to = now;
      break;
    case 'last_week':
      from = new Date(today.getTime() - (today.getDay() + 7) * 24 * 60 * 60 * 1000);
      to = new Date(today.getTime() - (today.getDay() + 1) * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
      break;
    case 'last_month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'this_year':
      from = new Date(now.getFullYear(), 0, 1);
      to = now;
      break;
    case 'custom':
      from = dateFrom ? new Date(dateFrom) : today;
      to = dateTo ? new Date(dateTo) : now;
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
  }

  const durationMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - durationMs);
  const prevTo = new Date(from.getTime() - 1);

  return { current: { from, to }, previous: { from: prevFrom, to: prevTo } };
}

/**
 * Registra la herramienta `analytics_revenue` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerRevenueReport(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'analytics_revenue',
    'Genera reporte de ingresos con comparación de período anterior y desglose diario',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      period: z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'custom']).default('this_month').describe('Período del reporte'),
      date_from: z.string().optional().describe('Fecha inicio para período custom (ISO 8601)'),
      date_to: z.string().optional().describe('Fecha fin para período custom (ISO 8601)'),
      compare_previous: z.boolean().default(true).describe('Comparar con período anterior (por defecto: true)'),
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
        const ranges = getDateRanges(params.period, params.date_from, params.date_to);
        const report = await prov.getRevenue(ranges.current);

        const currency = report.revenue.currency;

        const lines: string[] = [
          `💰 **Reporte de Ingresos — ${params.period.replace('_', ' ').toUpperCase()}**\n`,
          `📅 ${ranges.current.from.toLocaleDateString('es-ES')} → ${ranges.current.to.toLocaleDateString('es-ES')}\n`,
          '─'.repeat(55),
          '',
        ];

        // Métricas principales
        lines.push('📊 **Métricas Principales:**');
        lines.push(`  💰 Ingresos brutos: ${currency} ${report.revenue.amount.toFixed(2)}`);
        lines.push(`  💸 Reembolsos: ${currency} ${report.refundTotal.amount.toFixed(2)}`);
        lines.push(`  💵 Ingresos netos: ${currency} ${report.netRevenue.amount.toFixed(2)}`);
        lines.push(`  📦 Órdenes: ${report.orderCount}`);
        lines.push(`  🧾 Ticket promedio: ${currency} ${report.averageOrderValue.amount.toFixed(2)}`);

        // Comparación con período anterior
        if (params.compare_previous && report.previousPeriodRevenue && report.changePercent !== undefined) {
          lines.push('');
          lines.push('─'.repeat(55));
          lines.push('📈 **Comparación con período anterior:**');
          lines.push(`  💰 Revenue anterior: ${currency} ${report.previousPeriodRevenue.amount.toFixed(2)}`);

          const changeIcon = report.changePercent >= 0 ? '📈' : '📉';
          const changeSign = report.changePercent >= 0 ? '+' : '';
          lines.push(`  ${changeIcon} Cambio: ${changeSign}${report.changePercent.toFixed(1)}%`);

          const diff = report.revenue.amount - report.previousPeriodRevenue.amount;
          const diffSign = diff >= 0 ? '+' : '';
          lines.push(`  💵 Diferencia: ${diffSign}${currency} ${diff.toFixed(2)}`);
        }

        // Desglose diario
        if (report.dailyBreakdown && report.dailyBreakdown.length > 0) {
          lines.push('');
          lines.push('─'.repeat(55));
          lines.push('📅 **Desglose Diario:**');
          lines.push('| Fecha | Revenue | Órdenes | Ticket Prom. |');
          lines.push('|-------|---------|---------|--------------|');

          for (const day of report.dailyBreakdown) {
            lines.push(
              `| ${day.date} | ${currency} ${day.revenue.amount.toFixed(2)} | ${day.orders} | ${currency} ${day.averageOrderValue.amount.toFixed(2)} |`
            );
          }

          // Día con mejor y peor rendimiento
          if (report.dailyBreakdown.length > 1) {
            const sorted = [...report.dailyBreakdown].sort((a, b) => b.revenue.amount - a.revenue.amount);
            lines.push('');
            lines.push(`  🏆 Mejor día: ${sorted[0].date} (${currency} ${sorted[0].revenue.amount.toFixed(2)})`);
            lines.push(`  📉 Peor día: ${sorted[sorted.length - 1].date} (${currency} ${sorted[sorted.length - 1].revenue.amount.toFixed(2)})`);
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al generar reporte de ingresos: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
