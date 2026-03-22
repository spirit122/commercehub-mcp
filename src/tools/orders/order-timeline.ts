/**
 * @module tools/orders/order-timeline
 * @description Herramienta MCP para obtener la línea de tiempo completa de eventos
 * de una orden, formateada cronológicamente.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `orders_timeline` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerOrderTimeline(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'orders_timeline',
    'Obtiene la línea de tiempo completa de eventos de una orden, ordenada cronológicamente',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      order_id: z.string().min(1).describe('Identificador de la orden'),
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
        // Obtener orden e información básica
        const order = await prov.getOrder(params.order_id);
        const timeline = await prov.getOrderTimeline(params.order_id);

        const typeIcon = (type: string) => {
          switch (type) {
            case 'status_change': return '🔄';
            case 'payment': return '💰';
            case 'fulfillment': return '📦';
            case 'refund': return '💸';
            case 'note': return '📝';
            case 'cancellation': return '❌';
            case 'email': return '📧';
            case 'edit': return '✏️';
            default: return '📌';
          }
        };

        const lines: string[] = [
          `📅 **Timeline de la orden ${order.orderNumber}**`,
          ``,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| Orden | ${order.orderNumber} (ID: ${order.id}) |`,
          `| Cliente | ${order.customer.firstName} ${order.customer.lastName} |`,
          `| Estado actual | ${order.status} |`,
          `| Total | 💰 ${order.total.currency} ${order.total.amount.toFixed(2)} |`,
          ``,
        ];

        if (timeline.length === 0) {
          lines.push(`⚠️ No hay eventos registrados en la línea de tiempo de esta orden.`);
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        }

        lines.push(`## Eventos (${timeline.length})`, ``);

        // Ordenar cronológicamente (más antiguo primero)
        const sorted = [...timeline].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (let i = 0; i < sorted.length; i++) {
          const event = sorted[i];
          const date = new Date(event.createdAt);
          const dateStr = date.toLocaleDateString('es', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          const timeStr = date.toLocaleTimeString('es', {
            hour: '2-digit',
            minute: '2-digit',
          });

          const icon = typeIcon(event.type);
          const isLast = i === sorted.length - 1;
          const connector = isLast ? '└──' : '├──';

          lines.push(`${connector} ${icon} **${dateStr} ${timeStr}** — ${event.message}`);

          // Mostrar detalles adicionales si existen
          if (event.details && Object.keys(event.details).length > 0) {
            const prefix = isLast ? '    ' : '│   ';
            for (const [key, value] of Object.entries(event.details)) {
              lines.push(`${prefix}  _${key}_: ${String(value)}`);
            }
          }
        }

        // Resumen de tipos de eventos
        const typeCounts = new Map<string, number>();
        for (const event of timeline) {
          typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
        }

        lines.push(
          ``,
          `## 📊 Resumen de eventos`,
          `| Tipo | Cantidad |`,
          `|------|----------|`,
        );

        for (const [type, count] of typeCounts) {
          lines.push(`| ${typeIcon(type)} ${type} | ${count} |`);
        }

        // Calcular duración total
        if (sorted.length >= 2) {
          const firstDate = new Date(sorted[0].createdAt);
          const lastDate = new Date(sorted[sorted.length - 1].createdAt);
          const diffMs = lastDate.getTime() - firstDate.getTime();
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);

          let duration: string;
          if (diffDays > 0) {
            duration = `${diffDays} día(s) y ${diffHours % 24} hora(s)`;
          } else if (diffHours > 0) {
            duration = `${diffHours} hora(s)`;
          } else {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            duration = `${diffMinutes} minuto(s)`;
          }

          lines.push(``, `⏱️ Tiempo desde el primer evento: **${duration}**`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al obtener timeline: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
