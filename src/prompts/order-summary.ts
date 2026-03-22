/**
 * CommerceHub MCP - Prompt: Resumen de órdenes pendientes
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerOrderSummaryPrompt(server: McpServer) {
  server.prompt(
    'order-summary',
    'Resume todas las órdenes pendientes que necesitan atención: sin enviar, pagos pendientes, etc.',
    {
      provider: z.string().optional().describe('Plataforma de e-commerce'),
    },
    async (params) => {
      const provider = params.provider ?? 'todas las plataformas';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Resume las órdenes pendientes de ${provider} que necesitan atención.`,
                '',
                'Haz lo siguiente:',
                '1. Usa orders_list con status "pending" para órdenes con pago pendiente.',
                '2. Usa orders_list con fulfillment_status "unfulfilled" para órdenes sin enviar.',
                '3. Identifica órdenes antiguas (más de 48h sin enviar) como urgentes.',
                '',
                'Organiza por prioridad:',
                '- 🔴 URGENTE: Órdenes pagadas sin enviar por más de 48h',
                '- 🟡 ATENCIÓN: Órdenes pagadas sin enviar (menos de 48h)',
                '- 🔵 PENDIENTE: Órdenes con pago pendiente',
                '',
                'Para cada orden muestra: número, cliente, total, tiempo transcurrido.',
                'Al final, sugiere las 3 acciones más importantes a tomar.',
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}
