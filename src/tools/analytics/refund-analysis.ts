/**
 * @module tools/analytics/refund-analysis
 * @description Herramienta MCP para analizar reembolsos.
 * Muestra total reembolsado, tasa de reembolso, top razones y productos reembolsados.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `analytics_refunds` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerRefundAnalysis(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'analytics_refunds',
    'Analiza reembolsos con tasa, top razones y productos más reembolsados',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      period: z.enum(['today', 'this_week', 'this_month', 'last_month', 'this_year']).default('this_month').describe('Período a analizar'),
      group_by: z.enum(['reason', 'product', 'day']).optional().default('reason').describe('Agrupar reembolsos por razón, producto o día'),
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

        // Obtener reporte de revenue para tener datos de reembolsos
        const report = await prov.getRevenue({ from, to });

        // Obtener órdenes reembolsadas para detalles
        const orders = await prov.listOrders({
          status: 'refunded' as any,
          page: 1,
          limit: 100,
        });

        const currency = report.refundTotal.currency;
        const refundTotal = report.refundTotal.amount;
        const refundRate = report.orderCount > 0
          ? (orders.items.length / report.orderCount) * 100
          : 0;

        const lines: string[] = [
          `💸 **Análisis de Reembolsos — ${params.period.replace('_', ' ').toUpperCase()}**\n`,
          `📅 ${from.toLocaleDateString('es-ES')} → ${to.toLocaleDateString('es-ES')}\n`,
          '─'.repeat(55),
          '',
          '📊 **Resumen General:**',
          `  💸 Total reembolsado: ${currency} ${refundTotal.toFixed(2)}`,
          `  📦 Órdenes reembolsadas: ${orders.items.length}`,
          `  📊 Tasa de reembolso: ${refundRate.toFixed(1)}%`,
          `  💰 Revenue bruto: ${currency} ${report.revenue.amount.toFixed(2)}`,
          `  📈 % del revenue: ${report.revenue.amount > 0 ? ((refundTotal / report.revenue.amount) * 100).toFixed(1) : '0.0'}%`,
        ];

        // Indicador de salud
        const healthIcon = refundRate < 2 ? '🟢' : refundRate < 5 ? '🟡' : '🔴';
        const healthLabel = refundRate < 2 ? 'Saludable' : refundRate < 5 ? 'Atención' : 'Crítico';
        lines.push(`  ${healthIcon} Estado: **${healthLabel}**`);

        // Agrupación por razón (basada en notas de órdenes)
        if (params.group_by === 'reason' || !params.group_by) {
          const reasons = new Map<string, { count: number; amount: number }>();

          for (const order of orders.items) {
            // Usar notas o tags como proxy para razón
            const reason = order.note || 'Sin especificar';
            const existing = reasons.get(reason) || { count: 0, amount: 0 };
            existing.count++;
            existing.amount += order.total.amount;
            reasons.set(reason, existing);
          }

          if (reasons.size > 0) {
            lines.push('');
            lines.push('─'.repeat(55));
            lines.push('📋 **Top Razones de Reembolso:**');
            lines.push('| Razón | Cantidad | Monto | % del Total |');
            lines.push('|-------|----------|-------|-------------|');

            const sortedReasons = [...reasons.entries()].sort((a, b) => b[1].count - a[1].count);
            for (const [reason, data] of sortedReasons.slice(0, 10)) {
              const percent = refundTotal > 0 ? ((data.amount / refundTotal) * 100).toFixed(1) : '0.0';
              const shortReason = reason.length > 30 ? reason.substring(0, 27) + '...' : reason;
              lines.push(`| ${shortReason} | ${data.count} | ${currency} ${data.amount.toFixed(2)} | ${percent}% |`);
            }
          }
        }

        // Agrupación por producto
        if (params.group_by === 'product') {
          const products = new Map<string, { title: string; count: number; amount: number }>();

          for (const order of orders.items) {
            if (order.lineItems) {
              for (const item of order.lineItems) {
                const existing = products.get(item.productId) || { title: item.title, count: 0, amount: 0 };
                existing.count++;
                existing.amount += item.price.amount * item.quantity;
                products.set(item.productId, existing);
              }
            }
          }

          if (products.size > 0) {
            lines.push('');
            lines.push('─'.repeat(55));
            lines.push('📦 **Productos Más Reembolsados:**');
            lines.push('| Producto | Reembolsos | Monto | % del Total |');
            lines.push('|----------|------------|-------|-------------|');

            const sortedProducts = [...products.entries()].sort((a, b) => b[1].count - a[1].count);
            for (const [, data] of sortedProducts.slice(0, 10)) {
              const percent = refundTotal > 0 ? ((data.amount / refundTotal) * 100).toFixed(1) : '0.0';
              lines.push(`| ${data.title} | ${data.count} | ${currency} ${data.amount.toFixed(2)} | ${percent}% |`);
            }
          }
        }

        // Agrupación por día
        if (params.group_by === 'day') {
          const days = new Map<string, { count: number; amount: number }>();

          for (const order of orders.items) {
            const day = new Date(order.createdAt).toISOString().split('T')[0];
            const existing = days.get(day) || { count: 0, amount: 0 };
            existing.count++;
            existing.amount += order.total.amount;
            days.set(day, existing);
          }

          if (days.size > 0) {
            lines.push('');
            lines.push('─'.repeat(55));
            lines.push('📅 **Reembolsos por Día:**');
            lines.push('| Fecha | Cantidad | Monto |');
            lines.push('|-------|----------|-------|');

            const sortedDays = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]));
            for (const [day, data] of sortedDays) {
              lines.push(`| ${day} | ${data.count} | ${currency} ${data.amount.toFixed(2)} |`);
            }
          }
        }

        // Sugerencias
        lines.push('');
        lines.push('─'.repeat(55));
        lines.push('💡 **Sugerencias:**');
        if (refundRate > 5) {
          lines.push('  ⚠️ Tasa de reembolso alta. Revisa calidad de productos y descripciones.');
        }
        if (refundRate > 2) {
          lines.push('  📝 Implementa encuestas post-compra para identificar causas de insatisfacción.');
        }
        lines.push('  📊 Monitorea tendencia mensual para detectar picos estacionales.');

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al analizar reembolsos: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
