/**
 * @module tools/orders/order-notes
 * @description Herramienta MCP para agregar notas a una orden.
 * Las notas pueden ser internas o enviadas al cliente.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `orders_add_note` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerOrderNotes(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'orders_add_note',
    'Agrega una nota a una orden. Puede ser interna o enviada al cliente',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      order_id: z.string().min(1).describe('Identificador de la orden'),
      note: z.string().min(1).describe('Contenido de la nota'),
      notify_customer: z.boolean().default(false).describe('Enviar la nota al cliente por email (por defecto: false)'),
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
        // Agregar prefijo si se notifica al cliente para que el provider lo maneje
        const noteContent = params.notify_customer
          ? `[NOTIFICAR_CLIENTE] ${params.note}`
          : params.note;

        const orderNote = await prov.addOrderNote(params.order_id, noteContent);

        const lines: string[] = [
          `✅ **Nota agregada exitosamente**`,
          ``,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| ID de nota | ${orderNote.id} |`,
          `| Orden | ${params.order_id} |`,
          `| Autor | ${orderNote.author} |`,
          `| Tipo | ${params.notify_customer ? '📧 Visible para el cliente' : '🔒 Nota interna'} |`,
          `| Fecha | ${new Date(orderNote.createdAt).toLocaleString('es')} |`,
          ``,
          `📝 **Contenido:**`,
          `> ${params.note}`,
        ];

        if (params.notify_customer) {
          lines.push(``, `📧 Se envió notificación al cliente con el contenido de la nota.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al agregar nota: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
