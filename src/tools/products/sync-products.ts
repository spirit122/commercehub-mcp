/**
 * @module tools/products/sync-products
 * @description Herramienta MCP para sincronizar productos entre dos plataformas de e-commerce.
 * Soporta sincronización completa, solo nuevos o solo precios.
 * Incluye modo dry_run para previsualizar cambios sin ejecutarlos.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider, Product } from '../../types/index.js';

/**
 * Registra la herramienta `products_sync` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerSyncProducts(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_sync',
    'Sincroniza productos entre dos plataformas de e-commerce. Soporta modo simulación (dry_run)',
    {
      source_provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Proveedor de origen de los productos'),
      target_provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Proveedor de destino para la sincronización'),
      sync_mode: z.enum(['all', 'new_only', 'prices_only']).describe('Modo de sincronización: all (todo), new_only (solo nuevos), prices_only (solo precios)'),
      dry_run: z.boolean().default(true).describe('Si es true, muestra el plan sin ejecutar cambios (por defecto: true)'),
    },
    async (params) => {
      if (params.source_provider === params.target_provider) {
        return {
          content: [{ type: 'text' as const, text: '❌ Error: El proveedor de origen y destino no pueden ser el mismo.' }],
          isError: true,
        };
      }

      const sourceProv = providers.get(params.source_provider);
      if (!sourceProv) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error: Proveedor origen "${params.source_provider}" no configurado.` }],
          isError: true,
        };
      }

      const targetProv = providers.get(params.target_provider);
      if (!targetProv) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error: Proveedor destino "${params.target_provider}" no configurado.` }],
          isError: true,
        };
      }

      try {
        // Obtener todos los productos del origen
        const sourceResult = await sourceProv.listProducts({ limit: 100 });
        const sourceProducts = sourceResult.items;

        if (sourceProducts.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `📦 No hay productos en "${params.source_provider}" para sincronizar.` }],
          };
        }

        // Obtener productos existentes en el destino para comparar
        const targetResult = await targetProv.listProducts({ limit: 100 });
        const targetProducts = targetResult.items;
        const targetByTitle = new Map<string, Product>();
        for (const p of targetProducts) {
          targetByTitle.set(p.title.toLowerCase(), p);
        }

        const toCreate: Product[] = [];
        const toUpdate: Array<{ source: Product; target: Product }> = [];
        const toUpdatePrice: Array<{ source: Product; target: Product }> = [];
        const unchanged: Product[] = [];

        for (const srcProduct of sourceProducts) {
          const existing = targetByTitle.get(srcProduct.title.toLowerCase());

          if (!existing) {
            toCreate.push(srcProduct);
          } else if (params.sync_mode === 'prices_only') {
            const srcPrice = srcProduct.variants[0]?.price.amount;
            const tgtPrice = existing.variants[0]?.price.amount;
            if (srcPrice !== tgtPrice) {
              toUpdatePrice.push({ source: srcProduct, target: existing });
            } else {
              unchanged.push(srcProduct);
            }
          } else if (params.sync_mode === 'new_only') {
            unchanged.push(srcProduct);
          } else {
            // Modo 'all': actualizar existentes
            toUpdate.push({ source: srcProduct, target: existing });
          }
        }

        const modeLabel = params.sync_mode === 'all' ? 'Completa' : params.sync_mode === 'new_only' ? 'Solo nuevos' : 'Solo precios';

        const lines: string[] = [
          `🔄 **${params.dry_run ? 'Plan de sincronización (DRY RUN)' : 'Resultado de sincronización'}**`,
          ``,
          `| Parámetro | Valor |`,
          `|-----------|-------|`,
          `| Origen | ${params.source_provider} |`,
          `| Destino | ${params.target_provider} |`,
          `| Modo | ${modeLabel} |`,
          `| Productos en origen | ${sourceProducts.length} |`,
          `| Productos en destino | ${targetProducts.length} |`,
          ``,
        ];

        if (params.dry_run) {
          // Modo simulación: mostrar plan
          lines.push(`📋 **Plan de cambios:**`, ``);

          if (toCreate.length > 0 && params.sync_mode !== 'prices_only') {
            lines.push(`**🆕 Productos a crear (${toCreate.length}):**`);
            for (const p of toCreate) {
              const price = p.variants[0] ? `${p.variants[0].price.currency} ${p.variants[0].price.amount.toFixed(2)}` : 'N/A';
              lines.push(`- ${p.title} (💰 ${price})`);
            }
            lines.push(``);
          }

          if (toUpdate.length > 0) {
            lines.push(`**🔄 Productos a actualizar (${toUpdate.length}):**`);
            for (const { source } of toUpdate) {
              lines.push(`- ${source.title} (ID origen: ${source.id})`);
            }
            lines.push(``);
          }

          if (toUpdatePrice.length > 0) {
            lines.push(`**💰 Precios a actualizar (${toUpdatePrice.length}):**`);
            for (const { source, target } of toUpdatePrice) {
              const srcPrice = source.variants[0]?.price.amount.toFixed(2) ?? 'N/A';
              const tgtPrice = target.variants[0]?.price.amount.toFixed(2) ?? 'N/A';
              lines.push(`- ${source.title}: $${tgtPrice} → $${srcPrice}`);
            }
            lines.push(``);
          }

          if (unchanged.length > 0) {
            lines.push(`**✅ Sin cambios (${unchanged.length}):**`);
            for (const p of unchanged.slice(0, 5)) {
              lines.push(`- ${p.title}`);
            }
            if (unchanged.length > 5) lines.push(`- ... y ${unchanged.length - 5} más`);
          }

          lines.push(``, `⚠️ Ejecuta con \`dry_run: false\` para aplicar estos cambios.`);
        } else {
          // Ejecutar sincronización real
          let created = 0;
          let updated = 0;
          let failed = 0;
          const errors: string[] = [];

          // Crear nuevos
          if (params.sync_mode !== 'prices_only') {
            for (const p of toCreate) {
              try {
                await targetProv.createProduct({
                  title: p.title,
                  description: p.description,
                  status: p.status,
                  vendor: p.vendor,
                  productType: p.productType,
                  tags: p.tags,
                  variants: p.variants.map((v) => ({
                    title: v.title,
                    sku: v.sku,
                    price: v.price,
                    compareAtPrice: v.compareAtPrice,
                    inventoryQuantity: v.inventoryQuantity,
                    inventoryPolicy: v.inventoryPolicy,
                    requiresShipping: v.requiresShipping,
                    taxable: v.taxable,
                  })),
                });
                created++;
              } catch (err) {
                errors.push(`❌ Error creando "${p.title}": ${err instanceof Error ? err.message : 'Error'}`);
                failed++;
              }
            }
          }

          // Actualizar existentes
          for (const { source, target } of toUpdate) {
            try {
              await targetProv.updateProduct(target.id, {
                title: source.title,
                description: source.description,
                status: source.status,
                vendor: source.vendor,
                tags: source.tags,
                variants: source.variants.map((v) => ({
                  price: v.price,
                  compareAtPrice: v.compareAtPrice,
                })),
              });
              updated++;
            } catch (err) {
              errors.push(`❌ Error actualizando "${source.title}": ${err instanceof Error ? err.message : 'Error'}`);
              failed++;
            }
          }

          // Actualizar precios
          for (const { source, target } of toUpdatePrice) {
            try {
              await targetProv.updateProduct(target.id, {
                variants: [{ price: source.variants[0].price }],
              });
              updated++;
            } catch (err) {
              errors.push(`❌ Error actualizando precio de "${source.title}": ${err instanceof Error ? err.message : 'Error'}`);
              failed++;
            }
          }

          lines.push(
            `**📊 Resumen:**`,
            `| Acción | Cantidad |`,
            `|--------|----------|`,
            `| ✅ Creados | ${created} |`,
            `| 🔄 Actualizados | ${updated} |`,
            `| ❌ Fallidos | ${failed} |`,
            `| ⏭️ Sin cambios | ${unchanged.length} |`,
          );

          if (errors.length > 0) {
            lines.push(``, `**Errores:**`, ...errors);
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error en sincronización: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
