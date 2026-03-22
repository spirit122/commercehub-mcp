/**
 * @module tools/orders/refund-order
 * @description Herramienta MCP para procesar reembolsos en una orden.
 * Soporta reembolsos totales y parciales (por monto o por líneas de pedido).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider, RefundInput } from '../../types/index.js';

/**
 * Registra la herramienta `orders_refund` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerRefundOrder(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'orders_refund',
    'Procesa un reembolso total o parcial de una orden',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      order_id: z.string().min(1).describe('Identificador de la orden a reembolsar'),
      amount: z.number().positive().optional().describe('Monto a reembolsar. Si no se especifica, se hace reembolso total'),
      line_items: z.string().optional().describe('JSON array de líneas a reembolsar: [{"line_item_id": "xxx", "quantity": 1}]'),
      reason: z.string().optional().describe('Motivo del reembolso'),
      note: z.string().optional().describe('Nota interna adicional'),
      restock: z.boolean().default(true).describe('Reponer inventario de los productos reembolsados (por defecto: true)'),
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
        // Parsear line items si se proporcionan
        let parsedLineItems: RefundInput['lineItems'] = [];
        if (params.line_items) {
          try {
            const raw = JSON.parse(params.line_items);
            if (!Array.isArray(raw)) throw new Error('line_items debe ser un array JSON');
            parsedLineItems = raw.map((item: Record<string, unknown>) => ({
              id: String(item.line_item_id),
              quantity: Number(item.quantity),
            }));
          } catch (parseErr) {
            return {
              content: [{ type: 'text' as const, text: `❌ Error al parsear line_items: ${parseErr instanceof Error ? parseErr.message : 'JSON inválido'}` }],
              isError: true,
            };
          }
        }

        // Obtener la orden para información del reembolso
        const originalOrder = await prov.getOrder(params.order_id);
        const isFullRefund = !params.amount && parsedLineItems.length === 0;
        const refundAmount = params.amount ?? originalOrder.total.amount;
        const currency = originalOrder.total.currency;

        const refundInput: RefundInput = {
          orderId: params.order_id,
          amount: { amount: refundAmount, currency },
          lineItems: parsedLineItems,
          reason: params.reason || (isFullRefund ? 'Reembolso total' : 'Reembolso parcial'),
          note: params.note,
          restock: params.restock,
        };

        const order = await prov.refundOrder(refundInput);

        const lines: string[] = [
          `💸 **Reembolso procesado exitosamente**`,
          ``,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| Orden | ${order.orderNumber} |`,
          `| ID | ${order.id} |`,
          `| Tipo | ${isFullRefund ? '🔄 Reembolso total' : '📊 Reembolso parcial'} |`,
          `| Monto reembolsado | 💰 ${currency} ${refundAmount.toFixed(2)} |`,
          `| Total original | 💰 ${currency} ${originalOrder.total.amount.toFixed(2)} |`,
          `| Estado financiero | ${order.financialStatus} |`,
        ];

        if (params.reason) lines.push(`| Motivo | ${params.reason} |`);
        if (params.note) lines.push(`| Nota | ${params.note} |`);
        lines.push(`| Inventario repuesto | ${params.restock ? '✅ Sí' : '❌ No'} |`);

        if (parsedLineItems.length > 0) {
          lines.push(``, `## 📋 Líneas reembolsadas`);
          lines.push(`| ID línea | Cantidad |`);
          lines.push(`|----------|----------|`);
          for (const item of parsedLineItems) {
            lines.push(`| ${item.id} | ${item.quantity} |`);
          }
        }

        if (!isFullRefund) {
          const remaining = originalOrder.total.amount - refundAmount;
          lines.push(``, `💡 Monto restante en la orden: ${currency} ${remaining.toFixed(2)}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al procesar reembolso: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
