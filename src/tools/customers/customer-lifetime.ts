/**
 * @module tools/customers/customer-lifetime
 * @description Herramienta MCP para calcular el valor de vida del cliente (CLV).
 * Analiza revenue total, frecuencia de compra, ticket promedio,
 * predicción de próxima compra y riesgo de churn.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `customers_lifetime_value` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerCustomerLifetimeValue(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'customers_lifetime_value',
    'Calcula el valor de vida del cliente (CLV) con predicciones y riesgo de churn',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      customer_id: z.string().describe('Identificador del cliente'),
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
        const customer = await prov.getCustomer(params.customer_id);
        const orders = await prov.getCustomerOrders(params.customer_id, { limit: 100 });

        const currency = customer.totalSpent.currency;
        const totalOrders = customer.totalOrders;
        const totalRevenue = customer.totalSpent.amount;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Calcular frecuencia de compra
        let purchaseFrequencyDays = 0;
        let daysSinceLastOrder = 0;

        if (customer.lastOrderAt) {
          daysSinceLastOrder = Math.floor(
            (Date.now() - new Date(customer.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        if (customer.firstOrderAt && customer.lastOrderAt && totalOrders > 1) {
          const totalDays = Math.floor(
            (new Date(customer.lastOrderAt).getTime() - new Date(customer.firstOrderAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          purchaseFrequencyDays = Math.round(totalDays / (totalOrders - 1));
        }

        // Predicción de próxima compra
        let predictedNextOrder: Date | null = null;
        if (purchaseFrequencyDays > 0 && customer.lastOrderAt) {
          predictedNextOrder = new Date(
            new Date(customer.lastOrderAt).getTime() + purchaseFrequencyDays * 24 * 60 * 60 * 1000
          );
        }

        // Riesgo de churn
        let churnRisk: 'low' | 'medium' | 'high' = 'low';
        let churnRiskIcon = '🟢';
        if (daysSinceLastOrder > 120 || customer.segment === 'LOST') {
          churnRisk = 'high';
          churnRiskIcon = '🔴';
        } else if (daysSinceLastOrder > 60 || customer.segment === 'AT_RISK') {
          churnRisk = 'medium';
          churnRiskIcon = '🟡';
        }

        // CLV proyectado (12 meses)
        const monthlyRevenue = purchaseFrequencyDays > 0
          ? (avgOrderValue * (30 / purchaseFrequencyDays))
          : (totalOrders > 0 ? totalRevenue / 12 : 0);
        const projectedAnnualCLV = monthlyRevenue * 12;

        // Tendencia de gasto (basada en órdenes recientes vs antiguas)
        let trend = '➡️ Estable';
        if (orders.items.length >= 4) {
          const half = Math.floor(orders.items.length / 2);
          const recentAvg = orders.items.slice(0, half).reduce((s, o) => s + o.total.amount, 0) / half;
          const olderAvg = orders.items.slice(half).reduce((s, o) => s + o.total.amount, 0) / (orders.items.length - half);
          if (recentAvg > olderAvg * 1.1) trend = '📈 En aumento';
          else if (recentAvg < olderAvg * 0.9) trend = '📉 En declive';
        }

        const lines: string[] = [
          `💎 **Análisis de Valor de Vida del Cliente (CLV)**\n`,
          '─'.repeat(55),
          `👤 **${customer.firstName} ${customer.lastName}** (${customer.email})`,
          `🏷️ Segmento: ${customer.segment}`,
          '',
          '─'.repeat(55),
          '📊 **Métricas Históricas:**',
          `  💰 Revenue total: ${currency} ${totalRevenue.toFixed(2)}`,
          `  📦 Total órdenes: ${totalOrders}`,
          `  🧾 Ticket promedio: ${currency} ${avgOrderValue.toFixed(2)}`,
          `  📅 Frecuencia de compra: ${purchaseFrequencyDays > 0 ? `cada ${purchaseFrequencyDays} días` : 'Insuficientes datos'}`,
          `  ⏱️ Días desde última compra: ${daysSinceLastOrder}`,
          `  📈 Tendencia de gasto: ${trend}`,
          '',
          '─'.repeat(55),
          '🔮 **Predicciones:**',
          `  📅 Próxima compra estimada: ${predictedNextOrder ? predictedNextOrder.toLocaleDateString('es-ES') : 'Sin datos suficientes'}`,
          `  💰 CLV proyectado (12 meses): ${currency} ${projectedAnnualCLV.toFixed(2)}`,
          `  📊 Revenue mensual estimado: ${currency} ${monthlyRevenue.toFixed(2)}`,
          '',
          '─'.repeat(55),
          '⚠️ **Riesgo de Churn:**',
          `  ${churnRiskIcon} Nivel: ${churnRisk.toUpperCase()}`,
        ];

        if (churnRisk === 'high') {
          lines.push('  💡 **Acción sugerida:** Campaña de reactivación urgente. Ofrecer descuento personalizado.');
        } else if (churnRisk === 'medium') {
          lines.push('  💡 **Acción sugerida:** Email de seguimiento con productos recomendados basados en historial.');
        } else {
          lines.push('  💡 **Acción sugerida:** Mantener engagement con programa de fidelización.');
        }

        // Score visual
        lines.push('');
        lines.push('─'.repeat(55));
        const score = Math.min(100, Math.round(
          (totalOrders * 5) +
          (totalRevenue / 100) +
          (churnRisk === 'low' ? 30 : churnRisk === 'medium' ? 15 : 0)
        ));
        const scoreBar = '█'.repeat(Math.round(score / 5)) + '░'.repeat(20 - Math.round(score / 5));
        lines.push(`⭐ **Score CLV:** [${scoreBar}] ${score}/100`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al calcular CLV: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
