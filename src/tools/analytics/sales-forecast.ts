/**
 * @module tools/analytics/sales-forecast
 * @description Herramienta MCP para generar pronósticos de ventas.
 * Usa media móvil ponderada + tendencia lineal simple con rango de confianza.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `analytics_forecast` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerSalesForecast(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'analytics_forecast',
    'Genera pronóstico de ventas con media móvil ponderada, tendencia y rango de confianza',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      days_ahead: z.number().int().min(7).max(90).default(30).describe('Días a proyectar (por defecto: 30, máximo: 90)'),
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
        // Obtener datos históricos (últimos 90 días)
        const now = new Date();
        const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const report = await prov.getRevenue({ from, to: now });

        if (!report.dailyBreakdown || report.dailyBreakdown.length < 7) {
          return {
            content: [{ type: 'text' as const, text: '📊 Datos históricos insuficientes para generar pronóstico. Se necesitan al menos 7 días de datos.' }],
          };
        }

        const daily = report.dailyBreakdown;
        const currency = report.revenue.currency;

        // Calcular media móvil ponderada (últimos 7 días con más peso)
        const recentDays = daily.slice(-7);
        const weights = [1, 1.5, 2, 2.5, 3, 3.5, 4]; // Más peso a los días recientes
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const weightedAvgRevenue = recentDays.reduce((sum, d, i) => {
          const w = weights[Math.min(i, weights.length - 1)];
          return sum + d.revenue.amount * w;
        }, 0) / totalWeight;
        const weightedAvgOrders = recentDays.reduce((sum, d, i) => {
          const w = weights[Math.min(i, weights.length - 1)];
          return sum + d.orders * w;
        }, 0) / totalWeight;

        // Tendencia lineal simple (pendiente)
        const n = daily.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
          sumX += i;
          sumY += daily[i].revenue.amount;
          sumXY += i * daily[i].revenue.amount;
          sumX2 += i * i;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const trendDirection = slope > 0 ? '📈 Ascendente' : slope < 0 ? '📉 Descendente' : '➡️ Estable';

        // Proyección
        const projectedDailyRevenue = weightedAvgRevenue + slope * (params.days_ahead / 2);
        const projectedTotalRevenue = Math.max(0, projectedDailyRevenue * params.days_ahead);
        const projectedTotalOrders = Math.round(weightedAvgOrders * params.days_ahead);

        // Rango de confianza (basado en desviación estándar)
        const mean = daily.reduce((sum, d) => sum + d.revenue.amount, 0) / n;
        const variance = daily.reduce((sum, d) => sum + Math.pow(d.revenue.amount - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        const confidenceLow = Math.max(0, projectedTotalRevenue - stdDev * params.days_ahead * 0.5);
        const confidenceHigh = projectedTotalRevenue + stdDev * params.days_ahead * 0.5;
        const confidence = Math.max(0.3, Math.min(0.95, 1 - (stdDev / mean) * 0.5));

        const lines: string[] = [
          `🔮 **Pronóstico de Ventas — Próximos ${params.days_ahead} días**\n`,
          '─'.repeat(55),
          '',
          '📊 **Proyecciones:**',
          `  💰 Revenue proyectado: ${currency} ${projectedTotalRevenue.toFixed(2)}`,
          `  📦 Órdenes estimadas: ${projectedTotalOrders}`,
          `  🧾 Revenue diario promedio: ${currency} ${projectedDailyRevenue.toFixed(2)}`,
          `  📈 Tendencia: ${trendDirection} (${slope >= 0 ? '+' : ''}${currency} ${slope.toFixed(2)}/día)`,
          '',
          '─'.repeat(55),
          '📊 **Rango de Confianza:**',
          `  🔻 Escenario pesimista: ${currency} ${confidenceLow.toFixed(2)}`,
          `  🎯 Proyección central: ${currency} ${projectedTotalRevenue.toFixed(2)}`,
          `  🔺 Escenario optimista: ${currency} ${confidenceHigh.toFixed(2)}`,
          `  📊 Nivel de confianza: ${(confidence * 100).toFixed(0)}%`,
          '',
        ];

        // Gráfico ASCII de proyección semanal
        lines.push('─'.repeat(55));
        lines.push('📈 **Proyección semanal:**');
        lines.push('');

        const weeks = Math.ceil(params.days_ahead / 7);
        const maxWeeklyRevenue = (projectedDailyRevenue + Math.abs(slope) * params.days_ahead) * 7;

        for (let w = 1; w <= Math.min(weeks, 12); w++) {
          const weekRevenue = (weightedAvgRevenue + slope * (w * 7)) * 7;
          const safeRevenue = Math.max(0, weekRevenue);
          const barLen = maxWeeklyRevenue > 0 ? Math.max(1, Math.round((safeRevenue / maxWeeklyRevenue) * 20)) : 1;
          const bar = '█'.repeat(barLen);
          lines.push(`  Sem ${String(w).padStart(2, ' ')}: ${bar} ${currency} ${safeRevenue.toFixed(0)}`);
        }

        // Método utilizado
        lines.push('');
        lines.push('─'.repeat(55));
        lines.push('📝 **Metodología:**');
        lines.push('  - Media móvil ponderada (7 días, mayor peso a recientes)');
        lines.push('  - Regresión lineal simple para tendencia');
        lines.push(`  - Basado en ${n} días de datos históricos`);
        lines.push('  - Rango de confianza por desviación estándar');
        lines.push('');
        lines.push('⚠️ *Los pronósticos son estimaciones y pueden verse afectados por estacionalidad, promociones y eventos externos.*');

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
