/**
 * @module tools/products/get-product
 * @description Herramienta MCP para obtener el detalle completo de un producto.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `products_get` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerGetProduct(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_get',
    'Obtiene el detalle completo de un producto por su ID',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      product_id: z.string().min(1).describe('Identificador del producto'),
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
        const product = await prov.getProduct(params.product_id);

        const statusIcon = product.status === 'active' ? '✅' : product.status === 'draft' ? '📝' : '📁';

        const lines: string[] = [
          `📦 **${product.title}**`,
          ``,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| ID | ${product.id} |`,
          `| ID externo | ${product.externalId} |`,
          `| Proveedor | ${product.provider} |`,
          `| Estado | ${statusIcon} ${product.status} |`,
          `| Slug | ${product.slug} |`,
        ];

        if (product.vendor) lines.push(`| Vendedor | ${product.vendor} |`);
        if (product.productType) lines.push(`| Tipo | ${product.productType} |`);
        if (product.tags.length > 0) lines.push(`| Tags | ${product.tags.join(', ')} |`);
        lines.push(`| Creado | ${product.createdAt} |`);
        lines.push(`| Actualizado | ${product.updatedAt} |`);

        if (product.description) {
          lines.push(``, `📄 **Descripción:**`, product.description);
        }

        if (product.seoTitle || product.seoDescription) {
          lines.push(``, `🔍 **SEO:**`);
          if (product.seoTitle) lines.push(`- Título SEO: ${product.seoTitle}`);
          if (product.seoDescription) lines.push(`- Descripción SEO: ${product.seoDescription}`);
        }

        if (product.variants.length > 0) {
          lines.push(``, `🏷️ **Variantes (${product.variants.length}):**`, ``);
          lines.push(`| Variante | SKU | Precio | Stock | Envío |`);
          lines.push(`|----------|-----|--------|-------|-------|`);

          for (const v of product.variants) {
            const price = `${v.price.currency} ${v.price.amount.toFixed(2)}`;
            const compareAt = v.compareAtPrice ? ` ~~${v.compareAtPrice.currency} ${v.compareAtPrice.amount.toFixed(2)}~~` : '';
            const stockIcon = v.inventoryQuantity > 0 ? '✅' : '❌';
            lines.push(
              `| ${v.title} | ${v.sku || 'N/A'} | 💰 ${price}${compareAt} | ${stockIcon} ${v.inventoryQuantity} | ${v.requiresShipping ? '📦 Sí' : '🚫 No'} |`
            );
          }
        }

        if (product.images.length > 0) {
          lines.push(``, `🖼️ **Imágenes (${product.images.length}):**`);
          for (const img of product.images) {
            lines.push(`- ${img.alt || 'Sin alt'}: ${img.src}`);
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al obtener producto: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
