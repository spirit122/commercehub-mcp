/**
 * CommerceHub MCP - Resource: Órdenes recientes
 *
 * Expone las últimas órdenes de todas las tiendas conectadas.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../types/index.js';

export function registerRecentOrdersResource(
  server: McpServer,
  providers: Map<string, ICommerceProvider>,
) {
  server.resource(
    'recent-orders',
    'commercehub://orders/recent',
    {
      description: 'Últimas órdenes de todas las tiendas conectadas',
      mimeType: 'application/json',
    },
    async () => {
      const allOrders: unknown[] = [];

      for (const [name, provider] of providers) {
        if (!provider.isConfigured()) continue;
        try {
          const result = await provider.listOrders({ page: 1, limit: 10 });
          for (const order of result.items) {
            allOrders.push({
              provider: name,
              orderNumber: order.orderNumber,
              status: order.status,
              total: order.total,
              customer: order.customer
                ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim()
                : 'N/A',
              createdAt: order.createdAt,
            });
          }
        } catch {
          // Silenciar errores en resources
        }
      }

      // Ordenar por fecha más reciente
      allOrders.sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return {
        contents: [
          {
            uri: 'commercehub://orders/recent',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                count: allOrders.length,
                orders: allOrders.slice(0, 20),
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
