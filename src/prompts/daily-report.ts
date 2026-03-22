/**
 * CommerceHub MCP - Prompt: Reporte diario
 *
 * Prompt predefinido para generar un reporte ejecutivo del día.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDailyReportPrompt(server: McpServer) {
  server.prompt(
    'daily-report',
    'Genera un reporte ejecutivo completo del día con revenue, órdenes, productos top, alertas de inventario y métricas clave.',
    {
      provider: z.string().optional().describe('Plataforma de e-commerce (shopify, woocommerce, stripe, mercadolibre). Si no se especifica, usa todas las configuradas.'),
    },
    async (params) => {
      const provider = params.provider ?? 'todas las plataformas configuradas';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Genera un reporte ejecutivo completo del día de hoy para ${provider}.`,
                '',
                'Incluye las siguientes secciones:',
                '',
                '1. 💰 **Resumen de Revenue**: Usa la herramienta analytics_revenue con period "today" y compare_previous true.',
                '2. 📦 **Estado de Órdenes**: Usa orders_list para ver órdenes de hoy. Muestra pendientes, procesando y enviadas.',
                '3. 🏆 **Top 5 Productos**: Usa analytics_top_products con period "today" y limit 5.',
                '4. ⚠️ **Alertas de Inventario**: Usa inventory_low_stock con threshold 10 para ver productos que necesitan reabastecimiento.',
                '5. 👥 **Nuevos Clientes**: Usa customers_list para ver clientes nuevos del día.',
                '6. 💸 **Reembolsos**: Usa analytics_refunds con period "today" para ver si hay issues.',
                '7. 📊 **Ticket Promedio**: Usa analytics_avg_order con period "today".',
                '',
                'Formatea todo como un reporte ejecutivo claro y conciso con emojis y separadores.',
                'Al final, incluye 2-3 recomendaciones accionables basadas en los datos.',
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}
