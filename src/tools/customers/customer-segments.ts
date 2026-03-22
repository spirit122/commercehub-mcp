/**
 * @module tools/customers/customer-segments
 * @description Herramienta MCP para analizar la segmentación de clientes.
 * Muestra el breakdown de segmentos con conteo, porcentaje del revenue
 * y lógica de segmentación RFM simplificada.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `customers_segments` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerCustomerSegments(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'customers_segments',
    'Analiza la segmentación de clientes con conteo, revenue y criterios RFM',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      segment: z.enum(['VIP', 'REGULAR', 'NEW', 'AT_RISK', 'LOST', 'CHAMPION']).optional().describe('Filtrar por segmento específico (si no, muestra todos)'),
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
        // Obtener todos los clientes para segmentación
        const allCustomers = await prov.listCustomers({ limit: 100 });
        const customers = allCustomers.items;

        if (customers.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '👥 No hay clientes registrados para analizar.' }],
          };
        }

        const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent.amount, 0);
        const currency = customers[0]?.totalSpent.currency || 'USD';

        // Agrupar por segmento
        const segments = new Map<string, { count: number; revenue: number; avgOrderValue: number; customers: typeof customers }>();

        const segmentOrder = ['CHAMPION', 'VIP', 'REGULAR', 'NEW', 'AT_RISK', 'LOST'];

        for (const seg of segmentOrder) {
          segments.set(seg, { count: 0, revenue: 0, avgOrderValue: 0, customers: [] });
        }

        for (const customer of customers) {
          const seg = segments.get(customer.segment) || { count: 0, revenue: 0, avgOrderValue: 0, customers: [] };
          seg.count++;
          seg.revenue += customer.totalSpent.amount;
          seg.customers.push(customer);
          segments.set(customer.segment, seg);
        }

        // Calcular promedios
        for (const [, data] of segments) {
          data.avgOrderValue = data.count > 0 ? data.revenue / data.count : 0;
        }

        const segmentIcons: Record<string, string> = {
          CHAMPION: '🏆',
          VIP: '👑',
          REGULAR: '👤',
          NEW: '🆕',
          AT_RISK: '⚠️',
          LOST: '💤',
        };

        const segmentDescriptions: Record<string, string> = {
          CHAMPION: 'Compra frecuente y reciente, alto valor',
          VIP: 'Top 10% por gasto total',
          REGULAR: 'Patrones de compra estándar',
          NEW: 'Primera compra en últimos 30 días',
          AT_RISK: 'Sin compras en 60+ días, antes activo',
          LOST: 'Sin compras en 120+ días',
        };

        // Si se pidió un segmento específico
        if (params.segment) {
          const segData = segments.get(params.segment);
          if (!segData || segData.count === 0) {
            return {
              content: [{ type: 'text' as const, text: `👥 No hay clientes en el segmento ${params.segment}.` }],
            };
          }

          const revenuePercent = totalRevenue > 0 ? ((segData.revenue / totalRevenue) * 100).toFixed(1) : '0';

          const lines: string[] = [
            `${segmentIcons[params.segment]} **Segmento: ${params.segment}**\n`,
            `📝 ${segmentDescriptions[params.segment]}\n`,
            `👥 **Clientes:** ${segData.count} (${((segData.count / customers.length) * 100).toFixed(1)}% del total)`,
            `💰 **Revenue:** ${currency} ${segData.revenue.toFixed(2)} (${revenuePercent}% del total)`,
            `🧾 **Gasto promedio:** ${currency} ${segData.avgOrderValue.toFixed(2)}`,
            '',
            '| Nombre | Email | Total Gastado | Órdenes |',
            '|--------|-------|---------------|---------|',
          ];

          const sorted = segData.customers.sort((a, b) => b.totalSpent.amount - a.totalSpent.amount);
          for (const c of sorted.slice(0, 20)) {
            const name = `${c.firstName} ${c.lastName}`.trim();
            lines.push(`| ${name} | ${c.email} | ${currency} ${c.totalSpent.amount.toFixed(2)} | ${c.totalOrders} |`);
          }

          if (sorted.length > 20) {
            lines.push(`\n... y ${sorted.length - 20} más`);
          }

          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        }

        // Mostrar resumen de todos los segmentos
        const lines: string[] = [
          `👥 **Análisis de Segmentación de Clientes**\n`,
          `📊 ${customers.length} clientes analizados | Revenue total: ${currency} ${totalRevenue.toFixed(2)}\n`,
          '| Segmento | Clientes | % Clientes | Revenue | % Revenue | Gasto Prom. |',
          '|----------|----------|------------|---------|-----------|-------------|',
        ];

        for (const seg of segmentOrder) {
          const data = segments.get(seg)!;
          if (data.count === 0) continue;
          const clientPercent = ((data.count / customers.length) * 100).toFixed(1);
          const revPercent = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : '0.0';

          lines.push(
            `| ${segmentIcons[seg]} ${seg} | ${data.count} | ${clientPercent}% | ${currency} ${data.revenue.toFixed(2)} | ${revPercent}% | ${currency} ${data.avgOrderValue.toFixed(2)} |`
          );
        }

        // Gráfico visual de distribución
        lines.push('');
        lines.push('📊 **Distribución de Revenue:**');
        for (const seg of segmentOrder) {
          const data = segments.get(seg)!;
          if (data.count === 0) continue;
          const percent = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
          const barLen = Math.round(percent / 5);
          const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));
          lines.push(`  ${segmentIcons[seg]} ${seg.padEnd(10)} [${bar}] ${percent.toFixed(1)}%`);
        }

        lines.push('');
        lines.push('─'.repeat(60));
        lines.push('📝 **Criterios de segmentación:**');
        for (const seg of segmentOrder) {
          lines.push(`  ${segmentIcons[seg]} **${seg}:** ${segmentDescriptions[seg]}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al analizar segmentos: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
