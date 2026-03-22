/**
 * @module tools/orders/cancel-order
 * @description Herramienta MCP para cancelar una orden existente.
 * Permite especificar motivo, reposición de inventario y nota.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `orders_cancel` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerCancelOrder(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'orders_cancel',
    'Cancela una orden existente con motivo opcional y reposición de inventario',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      order_id: z.string().min(1).describe('Identificador de la orden a cancelar'),
      reason: z.enum(['customer', 'fraud', 'inventory', 'declined', 'other']).optional().describe('Motivo de la cancelación'),
      restock: z.boolean().default(true).describe('Reponer el inventario de los productos (por defecto: true)'),
      note: z.string().optional().describe('Nota adicional sobre la cancelación'),
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
        // Construir motivo completo
        const reasonLabels: Record<string, string> = {
          customer: 'Solicitud del cliente',
          fraud: 'Sospecha de fraude',
          inventory: 'Sin stock disponible',
          declined: 'Pago rechazado',
          other: 'Otro motivo',
        };

        const reasonText = params.reason
          ? `${reasonLabels[params.reason]}${params.note ? ` - ${params.note}` : ''}`
          : params.note || undefined;

        const order = await prov.cancelOrder(params.order_id, reasonText);

        const reasonIcon = (r?: string) => {
          switch (r) {
            case 'customer': return '👤';
            case 'fraud': return '🚨';
            case 'inventory': return '📦';
            case 'declined': return '💳';
            case 'other': return '📝';
            default: return '❓';
          }
        };

        const lines: string[] = [
          `❌ **Orden cancelada exitosamente**`,
          ``,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| Orden | ${order.orderNumber} |`,
          `| ID | ${order.id} |`,
          `| Estado | ❌ ${order.status} |`,
          `| Cliente | ${order.customer.firstName} ${order.customer.lastName} (${order.customer.email}) |`,
          `| Total | 💰 ${order.total.currency} ${order.total.amount.toFixed(2)} |`,
        ];

        if (params.reason) {
          lines.push(`| Motivo | ${reasonIcon(params.reason)} ${reasonLabels[params.reason]} |`);
        }
        if (params.note) {
          lines.push(`| Nota | ${params.note} |`);
        }

        lines.push(`| Inventario repuesto | ${params.restock ? '✅ Sí' : '❌ No'} |`);

        if (params.restock) {
          lines.push(``, `📦 El inventario de los productos fue repuesto automáticamente.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al cancelar orden: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
