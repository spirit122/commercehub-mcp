/**
 * @module tools/products/delete-product
 * @description Herramienta MCP para eliminar o archivar un producto.
 * Por defecto solo archiva el producto; se puede forzar la eliminación completa.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `products_delete` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerDeleteProduct(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_delete',
    'Elimina o archiva un producto. Por defecto solo lo archiva para mayor seguridad',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      product_id: z.string().min(1).describe('Identificador del producto a eliminar'),
      archive_only: z.boolean().default(true).describe('Si es true, solo archiva el producto en lugar de eliminarlo permanentemente (por defecto: true)'),
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
        if (params.archive_only) {
          // Archivar en lugar de eliminar permanentemente
          const product = await prov.updateProduct(params.product_id, { status: 'archived' });

          return {
            content: [{
              type: 'text' as const,
              text: [
                `📁 **Producto archivado exitosamente**`,
                ``,
                `| Campo | Valor |`,
                `|-------|-------|`,
                `| ID | ${product.id} |`,
                `| Título | ${product.title} |`,
                `| Estado | 📁 archived |`,
                ``,
                `⚠️ El producto fue archivado, no eliminado. Puede restaurarse cambiando su estado a "active" o "draft".`,
              ].join('\n'),
            }],
          };
        }

        // Eliminación permanente
        const result = await prov.deleteProduct(params.product_id);

        if (result.success) {
          return {
            content: [{
              type: 'text' as const,
              text: [
                `✅ **Producto eliminado permanentemente**`,
                ``,
                `| Campo | Valor |`,
                `|-------|-------|`,
                `| ID | ${params.product_id} |`,
                `| Proveedor | ${params.provider} |`,
                ``,
                `⚠️ Esta acción es irreversible. El producto ha sido eliminado del catálogo.`,
              ].join('\n'),
            }],
          };
        }

        return {
          content: [{ type: 'text' as const, text: `❌ No se pudo eliminar el producto: ${result.error || 'Error desconocido'}` }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al eliminar producto: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
