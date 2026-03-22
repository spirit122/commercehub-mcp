/**
 * @module tools/products/update-product
 * @description Herramienta MCP para actualizar un producto existente en una plataforma de e-commerce.
 * Solo se actualizan los campos proporcionados.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider, UpdateProductInput } from '../../types/index.js';

/**
 * Registra la herramienta `products_update` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerUpdateProduct(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_update',
    'Actualiza un producto existente. Solo se modifican los campos proporcionados',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      product_id: z.string().min(1).describe('Identificador del producto a actualizar'),
      title: z.string().min(1).optional().describe('Nuevo título del producto'),
      description: z.string().optional().describe('Nueva descripción del producto'),
      price: z.number().positive().optional().describe('Nuevo precio del producto'),
      compare_at_price: z.number().positive().optional().describe('Nuevo precio de comparación'),
      tags: z.string().optional().describe('Nuevos tags separados por coma'),
      status: z.enum(['active', 'draft', 'archived']).optional().describe('Nuevo estado del producto'),
      vendor: z.string().optional().describe('Nuevo vendedor o marca'),
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
        const fields: UpdateProductInput = {};
        const changes: string[] = [];

        if (params.title !== undefined) {
          fields.title = params.title;
          changes.push(`Título → "${params.title}"`);
        }
        if (params.description !== undefined) {
          fields.description = params.description;
          changes.push(`Descripción → actualizada`);
        }
        if (params.price !== undefined) {
          fields.variants = [{ price: { amount: params.price, currency: 'USD' } }];
          changes.push(`Precio → 💰 ${params.price}`);
        }
        if (params.compare_at_price !== undefined) {
          if (!fields.variants) fields.variants = [{}];
          fields.variants[0] = {
            ...fields.variants[0],
            compareAtPrice: { amount: params.compare_at_price, currency: 'USD' },
          };
          changes.push(`Precio comparación → 💰 ${params.compare_at_price}`);
        }
        if (params.tags !== undefined) {
          fields.tags = params.tags.split(',').map((t) => t.trim()).filter(Boolean);
          changes.push(`Tags → ${fields.tags.join(', ')}`);
        }
        if (params.status !== undefined) {
          fields.status = params.status;
          changes.push(`Estado → ${params.status}`);
        }
        if (params.vendor !== undefined) {
          fields.vendor = params.vendor;
          changes.push(`Vendedor → ${params.vendor}`);
        }

        if (changes.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '⚠️ No se proporcionaron campos para actualizar.' }],
          };
        }

        const product = await prov.updateProduct(params.product_id, fields);

        const lines: string[] = [
          `✅ **Producto actualizado exitosamente**`,
          ``,
          `📦 **${product.title}** (ID: ${product.id})`,
          ``,
          `**Cambios aplicados:**`,
          ...changes.map((c) => `- ${c}`),
          ``,
          `| Campo | Valor actual |`,
          `|-------|-------------|`,
          `| Estado | ${product.status} |`,
          `| Actualizado | ${product.updatedAt} |`,
        ];

        if (product.variants.length > 0) {
          const v = product.variants[0];
          lines.push(`| Precio | 💰 ${v.price.currency} ${v.price.amount.toFixed(2)} |`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al actualizar producto: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
