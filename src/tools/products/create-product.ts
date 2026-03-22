/**
 * @module tools/products/create-product
 * @description Herramienta MCP para crear un nuevo producto en una plataforma de e-commerce.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider, CreateProductInput } from '../../types/index.js';

/**
 * Registra la herramienta `products_create` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerCreateProduct(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_create',
    'Crea un nuevo producto en la plataforma de e-commerce',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      title: z.string().min(1).describe('Título del producto'),
      description: z.string().optional().describe('Descripción del producto en texto plano'),
      price: z.number().positive().describe('Precio del producto'),
      compare_at_price: z.number().positive().optional().describe('Precio de comparación (precio tachado)'),
      sku: z.string().optional().describe('Código SKU del producto'),
      variants: z.string().optional().describe('JSON array de variantes: [{title, sku, price, inventory_quantity}]'),
      images: z.string().optional().describe('JSON array de URLs de imágenes: ["url1", "url2"]'),
      tags: z.string().optional().describe('Tags separados por coma'),
      vendor: z.string().optional().describe('Vendedor o marca'),
      product_type: z.string().optional().describe('Tipo o categoría del producto'),
      status: z.enum(['active', 'draft', 'archived']).default('draft').describe('Estado inicial del producto (por defecto: draft)'),
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
        // Parsear variantes si se proporcionan
        let parsedVariants: CreateProductInput['variants'];
        if (params.variants) {
          try {
            const raw = JSON.parse(params.variants);
            if (!Array.isArray(raw)) throw new Error('variants debe ser un array JSON');
            parsedVariants = raw.map((v: Record<string, unknown>) => ({
              title: String(v.title || 'Default'),
              sku: v.sku ? String(v.sku) : undefined,
              price: { amount: Number(v.price || params.price), currency: 'USD' },
              compareAtPrice: v.compare_at_price ? { amount: Number(v.compare_at_price), currency: 'USD' } : undefined,
              inventoryQuantity: Number(v.inventory_quantity ?? 0),
              inventoryPolicy: 'deny' as const,
              requiresShipping: true,
              taxable: true,
            }));
          } catch (parseErr) {
            return {
              content: [{ type: 'text' as const, text: `❌ Error al parsear variantes: ${parseErr instanceof Error ? parseErr.message : 'JSON inválido'}` }],
              isError: true,
            };
          }
        }

        // Parsear imágenes si se proporcionan
        let parsedImages: CreateProductInput['images'];
        if (params.images) {
          try {
            const raw = JSON.parse(params.images);
            if (!Array.isArray(raw)) throw new Error('images debe ser un array JSON');
            parsedImages = raw.map((url: string, i: number) => ({
              src: String(url),
              position: i,
            }));
          } catch (parseErr) {
            return {
              content: [{ type: 'text' as const, text: `❌ Error al parsear imágenes: ${parseErr instanceof Error ? parseErr.message : 'JSON inválido'}` }],
              isError: true,
            };
          }
        }

        const input: CreateProductInput = {
          title: params.title,
          description: params.description,
          status: params.status,
          vendor: params.vendor,
          productType: params.product_type,
          tags: params.tags ? params.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
          variants: parsedVariants ?? [
            {
              title: 'Default',
              sku: params.sku,
              price: { amount: params.price, currency: 'USD' },
              compareAtPrice: params.compare_at_price ? { amount: params.compare_at_price, currency: 'USD' } : undefined,
              inventoryQuantity: 0,
              inventoryPolicy: 'deny' as const,
              requiresShipping: true,
              taxable: true,
            },
          ],
          images: parsedImages,
        };

        const product = await prov.createProduct(input);

        const lines: string[] = [
          `✅ **Producto creado exitosamente**`,
          ``,
          `| Campo | Valor |`,
          `|-------|-------|`,
          `| ID | ${product.id} |`,
          `| ID externo | ${product.externalId} |`,
          `| Título | ${product.title} |`,
          `| Estado | ${product.status} |`,
          `| Slug | ${product.slug} |`,
        ];

        if (product.vendor) lines.push(`| Vendedor | ${product.vendor} |`);
        if (product.tags.length > 0) lines.push(`| Tags | ${product.tags.join(', ')} |`);

        lines.push(`| Variantes | ${product.variants.length} |`);
        lines.push(`| Imágenes | ${product.images.length} |`);

        if (product.variants.length > 0) {
          const mainVariant = product.variants[0];
          lines.push(`| Precio principal | 💰 ${mainVariant.price.currency} ${mainVariant.price.amount.toFixed(2)} |`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al crear producto: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
