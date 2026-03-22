/**
 * CommerceHub MCP - Resource: Información de la tienda
 *
 * Expone información de las tiendas conectadas como recurso MCP.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../types/index.js';

export function registerStoreInfoResource(
  server: McpServer,
  providers: Map<string, ICommerceProvider>,
) {
  server.resource(
    'store-info',
    'commercehub://stores',
    {
      description: 'Información de las tiendas de e-commerce conectadas',
      mimeType: 'application/json',
    },
    async () => {
      const stores: Record<string, unknown>[] = [];

      for (const [name, provider] of providers) {
        stores.push({
          provider: name,
          configured: provider.isConfigured(),
          status: provider.isConfigured() ? 'connected' : 'not_configured',
        });
      }

      return {
        contents: [
          {
            uri: 'commercehub://stores',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                totalProviders: stores.length,
                stores,
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
