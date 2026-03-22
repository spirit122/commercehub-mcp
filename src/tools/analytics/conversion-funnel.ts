/**
 * @module tools/analytics/conversion-funnel
 * @description Herramienta MCP para obtener el embudo de conversión.
 * Muestra tasas de cada etapa: visitantes, carrito, checkout, compra completada.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `analytics_conversion` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerConversionFunnel(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'analytics_conversion',
    'Obtiene el embudo de conversión con tasas en cada etapa del proceso de compra',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      period: z.enum(['today', 'this_week', 'this_month', 'last_month', 'this_year']).default('this_month').describe('Período a analizar'),
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

        const funnel = await prov.getConversionFunnel({ from, to });

        // Embudo visual
        const maxWidth = 40;
        const getBar = (value: number, max: number) => {
          const width = max > 0 ? Math.max(1, Math.round((value / max) * maxWidth)) : 0;
          return '█'.repeat(width);
        };

        const maxVal = funnel.visitors || 1;

        const lines: string[] = [
          `🔄 **Embudo de Conversión — ${params.period.replace('_', ' ').toUpperCase()}**\n`,
          '─'.repeat(55),
          '',
          '📊 **Etapas del embudo:**',
          '',
        ];

        // Etapa 1: Visitantes
        lines.push(`  👁️ **Visitantes:**        ${funnel.visitors.toLocaleString('es-ES')}`);
        lines.push(`     ${getBar(funnel.visitors, maxVal)}`);
        lines.push(`     ↓ ${funnel.cartRate.toFixed(1)}% agregan al carrito`);
        lines.push('');

        // Etapa 2: Carrito
        lines.push(`  🛒 **Agregaron al carrito:** ${funnel.addedToCart.toLocaleString('es-ES')}`);
        lines.push(`     ${getBar(funnel.addedToCart, maxVal)}`);
        lines.push(`     ↓ ${funnel.checkoutRate.toFixed(1)}% inician checkout`);
        lines.push('');

        // Etapa 3: Checkout
        lines.push(`  💳 **Iniciaron checkout:** ${funnel.initiatedCheckout.toLocaleString('es-ES')}`);
        lines.push(`     ${getBar(funnel.initiatedCheckout, maxVal)}`);
        const purchaseRate = funnel.initiatedCheckout > 0
          ? ((funnel.completed / funnel.initiatedCheckout) * 100).toFixed(1)
          : '0.0';
        lines.push(`     ↓ ${purchaseRate}% completan compra`);
        lines.push('');

        // Etapa 4: Compras
        lines.push(`  ✅ **Completaron compra:** ${funnel.completed.toLocaleString('es-ES')}`);
        lines.push(`     ${getBar(funnel.completed, maxVal)}`);
        lines.push('');

        // Métricas clave
        lines.push('─'.repeat(55));
        lines.push('📊 **Métricas Clave:**');
        lines.push('');
        lines.push('| Métrica | Valor |');
        lines.push('|---------|-------|');
        lines.push(`| 🛒 Tasa de carrito (visitantes → carrito) | ${funnel.cartRate.toFixed(2)}% |`);
        lines.push(`| 💳 Tasa de checkout (carrito → checkout) | ${funnel.checkoutRate.toFixed(2)}% |`);
        lines.push(`| ✅ Tasa de compra (checkout → completado) | ${purchaseRate}% |`);
        lines.push(`| 🎯 **Conversión total** (visitantes → compra) | **${funnel.conversionRate.toFixed(2)}%** |`);

        // Abandonos
        const cartAbandoned = funnel.addedToCart - funnel.initiatedCheckout;
        const checkoutAbandoned = funnel.initiatedCheckout - funnel.completed;

        lines.push('');
        lines.push('─'.repeat(55));
        lines.push('⚠️ **Análisis de abandono:**');
        lines.push(`  🛒 Abandonos de carrito: ${cartAbandoned.toLocaleString('es-ES')} (${funnel.addedToCart > 0 ? ((cartAbandoned / funnel.addedToCart) * 100).toFixed(1) : 0}%)`);
        lines.push(`  💳 Abandonos de checkout: ${checkoutAbandoned.toLocaleString('es-ES')} (${funnel.initiatedCheckout > 0 ? ((checkoutAbandoned / funnel.initiatedCheckout) * 100).toFixed(1) : 0}%)`);

        // Sugerencias
        lines.push('');
        lines.push('💡 **Sugerencias:**');
        if (funnel.cartRate < 5) {
          lines.push('  - La tasa de carrito es baja. Considera mejorar las fichas de producto y CTAs.');
        }
        if (funnel.checkoutRate < 30) {
          lines.push('  - Muchos abandonan el carrito. Implementa emails de recuperación de carrito.');
        }
        if (parseFloat(purchaseRate) < 50) {
          lines.push('  - El checkout tiene alta tasa de abandono. Simplifica el proceso de pago.');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al obtener embudo de conversión: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
