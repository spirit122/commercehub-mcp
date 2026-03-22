/**
 * @module tools/analytics/dashboard-summary
 * @description Herramienta MCP para generar un resumen ejecutivo completo del dashboard.
 * Agrega revenue, órdenes, top productos, alertas de stock, clientes y conversión.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `analytics_dashboard` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerDashboardSummary(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'analytics_dashboard',
    'Genera resumen ejecutivo completo con revenue, órdenes, top productos, stock, clientes y conversión',
    {
      providers: z.array(z.string()).optional().describe('Lista de proveedores (JSON array, si no se proporciona usa todos los configurados)'),
      period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'last_month']).default('today').describe('Período del resumen (por defecto: today)'),
    },
    async (params) => {
      const providerNames = params.providers || Array.from(providers.keys());

      if (providerNames.length === 0) {
        return {
          content: [{ type: 'text' as const, text: '❌ Error: No hay proveedores configurados.' }],
          isError: true,
        };
      }

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
          case 'yesterday':
            from = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'this_week': from = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000); break;
          case 'this_month': from = new Date(now.getFullYear(), now.getMonth(), 1); break;
          case 'last_month': from = new Date(now.getFullYear(), now.getMonth() - 1, 1); break;
          default: from = today;
        }

        const to = params.period === 'yesterday'
          ? new Date(today.getTime() - 1)
          : params.period === 'last_month'
            ? new Date(now.getFullYear(), now.getMonth(), 0)
            : now;

        let totalRevenue = 0;
        let totalOrders = 0;
        let totalRefunds = 0;
        let prevRevenue = 0;
        let currency = 'USD';

        // Recopilar datos de todos los proveedores
        const allTopProducts: Array<{ title: string; revenue: number; qty: number }> = [];
        const allLowStock: Array<{ sku: string; title: string; available: number }> = [];
        let totalNewCustomers = 0;
        let conversionRate = 0;
        let conversionCount = 0;

        // Datos de órdenes por estado
        let pendingOrders = 0;
        let processingOrders = 0;
        let shippedOrders = 0;

        for (const provName of providerNames) {
          const prov = providers.get(provName)!;

          try {
            // Revenue
            const report = await prov.getRevenue({ from, to });
            totalRevenue += report.revenue.amount;
            totalOrders += report.orderCount;
            totalRefunds += report.refundTotal.amount;
            currency = report.revenue.currency;

            if (report.previousPeriodRevenue) {
              prevRevenue += report.previousPeriodRevenue.amount;
            }

            // Top productos
            try {
              const top = await prov.getTopProducts({ from, to }, 5);
              for (const p of top) {
                allTopProducts.push({ title: p.title, revenue: p.revenue.amount, qty: p.quantitySold });
              }
            } catch { /* ignorar si no soporta */ }

            // Stock bajo
            try {
              const inv = await prov.getInventory({ maxAvailable: 10, belowReorderPoint: true });
              for (const item of inv.items.slice(0, 5)) {
                allLowStock.push({ sku: item.sku, title: item.productTitle, available: item.available });
              }
            } catch { /* ignorar */ }

            // Nuevos clientes
            try {
              const customers = await prov.listCustomers({ segment: 'NEW' as any, limit: 1 });
              totalNewCustomers += customers.total;
            } catch { /* ignorar */ }

            // Conversión
            try {
              const funnel = await prov.getConversionFunnel({ from, to });
              conversionRate += funnel.conversionRate;
              conversionCount++;
            } catch { /* ignorar */ }

            // Órdenes por estado
            try {
              const pending = await prov.listOrders({ status: 'pending' as any, limit: 1 });
              pendingOrders += pending.total;
            } catch { /* ignorar */ }
            try {
              const processing = await prov.listOrders({ status: 'processing' as any, limit: 1 });
              processingOrders += processing.total;
            } catch { /* ignorar */ }
            try {
              const shipped = await prov.listOrders({ status: 'shipped' as any, limit: 1 });
              shippedOrders += shipped.total;
            } catch { /* ignorar */ }
          } catch {
            // Proveedor falló, continuar con los demás
          }
        }

        const avgConversion = conversionCount > 0 ? conversionRate / conversionCount : 0;
        const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
        const changeIcon = revenueChange >= 0 ? '📈' : '📉';
        const changeSign = revenueChange >= 0 ? '+' : '';
        const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        const lines: string[] = [
          '═'.repeat(60),
          `  📊 DASHBOARD EJECUTIVO — ${params.period.replace('_', ' ').toUpperCase()}`,
          `  📅 ${from.toLocaleDateString('es-ES')} → ${to.toLocaleDateString('es-ES')}`,
          `  🏪 Canales: ${providerNames.join(', ')}`,
          '═'.repeat(60),
          '',
        ];

        // 1. Revenue
        lines.push('💰 **REVENUE**');
        lines.push(`  💵 Ingresos: ${currency} ${totalRevenue.toFixed(2)}`);
        lines.push(`  ${changeIcon} Cambio vs. período anterior: ${changeSign}${revenueChange.toFixed(1)}%`);
        lines.push(`  💸 Reembolsos: ${currency} ${totalRefunds.toFixed(2)}`);
        lines.push(`  💰 Neto: ${currency} ${(totalRevenue - totalRefunds).toFixed(2)}`);
        lines.push('');

        // 2. Órdenes
        lines.push('📦 **ORDENES**');
        lines.push(`  📊 Total: ${totalOrders}`);
        lines.push(`  ⏳ Pendientes: ${pendingOrders}`);
        lines.push(`  🔄 Procesando: ${processingOrders}`);
        lines.push(`  🚚 Enviadas: ${shippedOrders}`);
        lines.push(`  🧾 Ticket promedio: ${currency} ${avgTicket.toFixed(2)}`);
        lines.push('');

        // 3. Top 5 productos
        if (allTopProducts.length > 0) {
          allTopProducts.sort((a, b) => b.revenue - a.revenue);
          const top5 = allTopProducts.slice(0, 5);
          lines.push('🏆 **TOP 5 PRODUCTOS**');
          const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
          for (const [i, p] of top5.entries()) {
            lines.push(`  ${medals[i]} ${p.title} — ${currency} ${p.revenue.toFixed(2)} (${p.qty} uds)`);
          }
          lines.push('');
        }

        // 4. Alertas de stock
        if (allLowStock.length > 0) {
          lines.push('⚠️ **ALERTAS DE STOCK BAJO**');
          for (const item of allLowStock.slice(0, 5)) {
            const icon = item.available === 0 ? '🔴' : '🟡';
            lines.push(`  ${icon} ${item.sku} — ${item.title}: ${item.available} uds`);
          }
          lines.push('');
        }

        // 5. Clientes
        lines.push('👥 **CLIENTES**');
        lines.push(`  🆕 Nuevos clientes: ${totalNewCustomers}`);
        lines.push('');

        // 6. Conversión
        if (avgConversion > 0) {
          lines.push('📊 **CONVERSION**');
          lines.push(`  🎯 Tasa de conversión: ${avgConversion.toFixed(2)}%`);
          lines.push('');
        }

        // 7. Reembolsos
        const refundRate = totalOrders > 0 ? (totalRefunds / totalRevenue) * 100 : 0;
        lines.push('💸 **REEMBOLSOS**');
        lines.push(`  💸 Total: ${currency} ${totalRefunds.toFixed(2)}`);
        lines.push(`  📊 Tasa: ${refundRate.toFixed(1)}% del revenue`);
        lines.push('');

        lines.push('═'.repeat(60));

        // Alertas importantes
        const alerts: string[] = [];
        if (revenueChange < -10) alerts.push('📉 Revenue bajó más del 10% respecto al período anterior');
        if (refundRate > 5) alerts.push('💸 Tasa de reembolso superior al 5%');
        if (allLowStock.some((i) => i.available === 0)) alerts.push('🔴 Hay productos agotados');
        if (pendingOrders > 10) alerts.push('⏳ Más de 10 órdenes pendientes de procesar');

        if (alerts.length > 0) {
          lines.push('');
          lines.push('🚨 **ALERTAS:**');
          for (const alert of alerts) {
            lines.push(`  ${alert}`);
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al generar dashboard: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
