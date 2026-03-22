/**
 * CommerceHub MCP - Resource: Alertas de inventario
 *
 * Expone productos con stock bajo como recurso MCP en tiempo real.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../types/index.js';

export function registerInventoryAlertsResource(
  server: McpServer,
  providers: Map<string, ICommerceProvider>,
) {
  server.resource(
    'inventory-alerts',
    'commercehub://inventory/alerts',
    {
      description: 'Productos con stock bajo o agotado en todas las tiendas',
      mimeType: 'application/json',
    },
    async () => {
      const alerts: unknown[] = [];

      for (const [name, provider] of providers) {
        if (!provider.isConfigured()) continue;
        try {
          // Obtener productos con stock bajo (umbral: 10 unidades)
          const products = await provider.listProducts(
            { status: 'active', page: 1, limit: 100 },
          );

          for (const product of products.items) {
            for (const variant of product.variants) {
              if (variant.inventoryQuantity <= 10) {
                alerts.push({
                  provider: name,
                  productId: product.id,
                  productTitle: product.title,
                  variantTitle: variant.title,
                  sku: variant.sku,
                  currentStock: variant.inventoryQuantity,
                  severity:
                    variant.inventoryQuantity === 0
                      ? 'critical'
                      : variant.inventoryQuantity <= 3
                        ? 'high'
                        : 'medium',
                });
              }
            }
          }
        } catch {
          // Silenciar errores en resources
        }
      }

      // Ordenar por severidad
      const severityOrder = { critical: 0, high: 1, medium: 2 };
      alerts.sort(
        (a: any, b: any) =>
          (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) -
          (severityOrder[b.severity as keyof typeof severityOrder] ?? 3),
      );

      return {
        contents: [
          {
            uri: 'commercehub://inventory/alerts',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                totalAlerts: alerts.length,
                critical: alerts.filter((a: any) => a.severity === 'critical').length,
                high: alerts.filter((a: any) => a.severity === 'high').length,
                medium: alerts.filter((a: any) => a.severity === 'medium').length,
                alerts,
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
