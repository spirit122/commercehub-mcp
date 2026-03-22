/**
 * CommerceHub MCP - Prompt: Verificación de inventario
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerInventoryCheckPrompt(server: McpServer) {
  server.prompt(
    'inventory-check',
    '¿Qué productos necesito reabastecer? Análisis completo de inventario con predicciones.',
    {
      provider: z.string().optional().describe('Plataforma de e-commerce'),
      threshold: z.string().optional().describe('Umbral de stock bajo (default: 10)'),
    },
    async (params) => {
      const provider = params.provider ?? 'todas las plataformas';
      const threshold = params.threshold ?? '10';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Analiza el inventario de ${provider} y dime qué productos necesito reabastecer.`,
                '',
                `1. Usa inventory_low_stock con threshold ${threshold} para encontrar productos con stock bajo.`,
                '2. Usa inventory_forecast para los productos críticos y predecir cuándo se agotarán.',
                '3. Usa analytics_top_products del último mes para priorizar reabastecimiento de los más vendidos.',
                '',
                'Organiza los resultados así:',
                '- 🔴 AGOTADO: Stock en 0, necesita reorden inmediata',
                '- 🟠 CRÍTICO: Se agotará en menos de 7 días',
                '- 🟡 BAJO: Stock bajo pero con más de 7 días de margen',
                '- ✅ OK: Stock suficiente',
                '',
                'Para los productos que necesitan reorden, sugiere la cantidad basada en la velocidad de venta.',
                'Calcula el costo estimado de reabastecimiento si hay datos de costo por item.',
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}
