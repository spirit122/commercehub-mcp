/**
 * @module tools/products/bulk-update-prices
 * @description Herramienta MCP para actualización masiva de precios de productos.
 * Permite actualizar precios individualmente por producto/SKU o aplicar un
 * porcentaje de cambio a todos los productos proporcionados.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `products_bulk_price` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerBulkUpdatePrices(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_bulk_price',
    'Actualización masiva de precios. Permite fijar precios individuales o aplicar un porcentaje de ajuste',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      updates: z.string().describe('JSON array de actualizaciones: [{"product_id": "xxx", "new_price": 29.99}] o [{"sku": "ABC", "new_price": 29.99}]'),
      apply_percentage: z.number().optional().describe('Porcentaje de ajuste a aplicar (ej: 10 para +10%, -15 para -15%). Si se proporciona, ignora new_price y calcula sobre el precio actual'),
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
        // Parsear las actualizaciones
        let updates: Array<{ product_id?: string; sku?: string; new_price?: number }>;
        try {
          updates = JSON.parse(params.updates);
          if (!Array.isArray(updates)) throw new Error('updates debe ser un array JSON');
        } catch (parseErr) {
          return {
            content: [{ type: 'text' as const, text: `❌ Error al parsear updates: ${parseErr instanceof Error ? parseErr.message : 'JSON inválido'}` }],
            isError: true,
          };
        }

        if (updates.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '⚠️ No se proporcionaron productos para actualizar.' }],
          };
        }

        let successCount = 0;
        let failCount = 0;
        const results: string[] = [];

        for (const update of updates) {
          const productId = update.product_id;
          if (!productId && !update.sku) {
            results.push(`❌ Entrada inválida: falta product_id o sku`);
            failCount++;
            continue;
          }

          try {
            let targetPrice: number;

            if (params.apply_percentage !== undefined) {
              // Obtener precio actual y calcular el nuevo
              if (!productId) {
                results.push(`❌ SKU "${update.sku}": apply_percentage requiere product_id para obtener precio actual`);
                failCount++;
                continue;
              }
              const currentProduct = await prov.getProduct(productId);
              const currentPrice = currentProduct.variants[0]?.price.amount;
              if (currentPrice === undefined) {
                results.push(`❌ Producto ${productId}: no se pudo obtener el precio actual`);
                failCount++;
                continue;
              }
              targetPrice = Number((currentPrice * (1 + params.apply_percentage / 100)).toFixed(2));
            } else if (update.new_price !== undefined) {
              targetPrice = update.new_price;
            } else {
              results.push(`❌ Producto ${productId || update.sku}: falta new_price y no se proporcionó apply_percentage`);
              failCount++;
              continue;
            }

            if (targetPrice <= 0) {
              results.push(`⚠️ Producto ${productId || update.sku}: precio calculado (${targetPrice}) es <= 0, omitido`);
              failCount++;
              continue;
            }

            if (productId) {
              await prov.updateProduct(productId, {
                variants: [{ price: { amount: targetPrice, currency: 'USD' } }],
              });
              results.push(`✅ Producto ${productId}: precio actualizado a 💰 $${targetPrice.toFixed(2)}`);
            }

            successCount++;
          } catch (err) {
            const id = productId || update.sku;
            results.push(`❌ Producto ${id}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
            failCount++;
          }
        }

        const summary = [
          `💰 **Actualización masiva de precios completada**`,
          ``,
          `| Métrica | Valor |`,
          `|---------|-------|`,
          `| Total procesados | ${updates.length} |`,
          `| ✅ Exitosos | ${successCount} |`,
          `| ❌ Fallidos | ${failCount} |`,
        ];

        if (params.apply_percentage !== undefined) {
          const sign = params.apply_percentage >= 0 ? '+' : '';
          summary.push(`| Ajuste aplicado | ${sign}${params.apply_percentage}% |`);
        }

        summary.push(``, `**Detalle:**`, ...results);

        return { content: [{ type: 'text' as const, text: summary.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error en actualización masiva: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
