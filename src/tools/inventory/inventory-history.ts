/**
 * @module tools/inventory/inventory-history
 * @description Herramienta MCP para consultar el historial cronológico de movimientos
 * de inventario de un producto específico.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `inventory_history` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerInventoryHistory(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'inventory_history',
    'Consulta el historial cronológico de movimientos de inventario de un producto',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      sku: z.string().optional().describe('Código SKU del producto/variante'),
      product_id: z.string().optional().describe('Identificador del producto (alternativa a SKU)'),
      date_from: z.string().optional().describe('Fecha inicio del rango (ISO 8601, ej: 2026-01-01)'),
      date_to: z.string().optional().describe('Fecha fin del rango (ISO 8601, ej: 2026-03-31)'),
      limit: z.number().int().min(1).max(200).default(50).describe('Cantidad máxima de movimientos (por defecto: 50)'),
    },
    async (params) => {
      const prov = providers.get(params.provider);
      if (!prov) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error: Proveedor "${params.provider}" no configurado.` }],
          isError: true,
        };
      }

      if (!params.sku && !params.product_id) {
        return {
          content: [{ type: 'text' as const, text: '❌ Error: Debe proporcionar al menos un `sku` o `product_id`.' }],
          isError: true,
        };
      }

      try {
        // Resolver SKU si se proporcionó product_id
        let sku = params.sku;
        if (!sku && params.product_id) {
          const inv = await prov.getInventory({ productId: params.product_id });
          if (inv.items.length > 0) {
            sku = inv.items[0].sku;
          } else {
            return {
              content: [{ type: 'text' as const, text: `❌ No se encontró inventario para el producto "${params.product_id}".` }],
              isError: true,
            };
          }
        }

        const dateRange = (params.date_from || params.date_to)
          ? {
              from: params.date_from ? new Date(params.date_from) : new Date(0),
              to: params.date_to ? new Date(params.date_to) : new Date(),
            }
          : undefined;

        let movements = await prov.getInventoryHistory(sku!, dateRange);

        // Aplicar límite
        movements = movements.slice(0, params.limit);

        if (movements.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `📦 No se encontraron movimientos de inventario para SKU "${sku}" en el período indicado.` }],
          };
        }

        const reasonIcons: Record<string, string> = {
          received: '📥',
          sold: '🛒',
          returned: '↩️',
          adjustment: '🔧',
          damaged: '💔',
          manual: '✏️',
        };

        const reasonLabels: Record<string, string> = {
          received: 'Recibido',
          sold: 'Vendido',
          returned: 'Devolución',
          adjustment: 'Ajuste',
          damaged: 'Dañado',
          manual: 'Manual',
        };

        const lines: string[] = [
          `📜 **Historial de Inventario** — SKU: ${sku}\n`,
          `📊 ${movements.length} movimiento(s) encontrado(s)`,
        ];

        if (params.date_from || params.date_to) {
          lines.push(`📅 Período: ${params.date_from || '—'} → ${params.date_to || 'hoy'}`);
        }

        lines.push('');
        lines.push('| Fecha | Motivo | Cambio | Antes → Después | Usuario |');
        lines.push('|-------|--------|--------|-----------------|---------|');

        for (const mov of movements) {
          const date = new Date(mov.createdAt).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const icon = reasonIcons[mov.reason] || '❓';
          const label = reasonLabels[mov.reason] || mov.reason;
          const changeStr = mov.change >= 0 ? `+${mov.change}` : `${mov.change}`;
          const changeColor = mov.change >= 0 ? '📈' : '📉';
          const user = mov.createdBy || '—';

          lines.push(
            `| ${date} | ${icon} ${label} | ${changeColor} ${changeStr} | ${mov.previousQuantity} → ${mov.newQuantity} | ${user} |`
          );
        }

        // Resumen de movimientos
        const totalIn = movements.filter((m) => m.change > 0).reduce((sum, m) => sum + m.change, 0);
        const totalOut = movements.filter((m) => m.change < 0).reduce((sum, m) => sum + Math.abs(m.change), 0);
        const netChange = totalIn - totalOut;

        lines.push('');
        lines.push('─'.repeat(60));
        lines.push(`📋 **Resumen del período:**`);
        lines.push(`  📥 Entradas: +${totalIn}`);
        lines.push(`  📤 Salidas: -${totalOut}`);
        lines.push(`  📊 Cambio neto: ${netChange >= 0 ? '+' : ''}${netChange}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al consultar historial: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
