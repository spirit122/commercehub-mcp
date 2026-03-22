/**
 * @module tools/products/generate-description
 * @description Herramienta MCP para auditar el SEO de un producto.
 * Analiza título, descripción, imágenes y tags, generando un reporte
 * con puntuación y recomendaciones específicas de mejora.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `products_seo_audit` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerProductSeoAudit(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'products_seo_audit',
    'Audita el SEO de un producto: analiza título, descripción, imágenes y tags con puntuación y recomendaciones',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      product_id: z.string().min(1).describe('Identificador del producto a auditar'),
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

        let totalScore = 0;
        let maxScore = 0;
        const issues: string[] = [];
        const warnings: string[] = [];
        const passed: string[] = [];

        // ── Análisis del título ──
        maxScore += 25;
        const titleLength = product.title?.length ?? 0;
        if (titleLength === 0) {
          issues.push('❌ **Título**: Falta el título del producto');
        } else if (titleLength < 20) {
          warnings.push('⚠️ **Título**: Demasiado corto (< 20 caracteres). Incluye keywords relevantes');
          totalScore += 10;
        } else if (titleLength > 70) {
          warnings.push('⚠️ **Título**: Demasiado largo (> 70 caracteres). Los buscadores lo truncarán');
          totalScore += 15;
        } else {
          passed.push('✅ **Título**: Longitud óptima (' + titleLength + ' caracteres)');
          totalScore += 25;
        }

        // ── Análisis del título SEO ──
        maxScore += 15;
        const seoTitle = product.seoTitle;
        if (!seoTitle) {
          warnings.push('⚠️ **Título SEO**: No definido. Se usará el título del producto por defecto');
          totalScore += 5;
        } else if (seoTitle.length < 30) {
          warnings.push('⚠️ **Título SEO**: Demasiado corto (< 30 caracteres)');
          totalScore += 8;
        } else if (seoTitle.length > 60) {
          warnings.push('⚠️ **Título SEO**: Demasiado largo (> 60 caracteres). Se truncará en Google');
          totalScore += 10;
        } else {
          passed.push('✅ **Título SEO**: Longitud óptima (' + seoTitle.length + ' caracteres)');
          totalScore += 15;
        }

        // ── Análisis de la descripción ──
        maxScore += 20;
        const description = product.description ?? '';
        const htmlDescription = product.htmlDescription ?? '';
        const descLength = description.length;

        if (descLength === 0 && htmlDescription.length === 0) {
          issues.push('❌ **Descripción**: Falta completamente. Esto afecta severamente el SEO');
        } else if (descLength < 50) {
          warnings.push('⚠️ **Descripción**: Demasiado corta (< 50 caracteres). Agrega detalles del producto');
          totalScore += 8;
        } else if (descLength < 150) {
          warnings.push('⚠️ **Descripción**: Mejorable (< 150 caracteres). Idealmente 150-300 caracteres');
          totalScore += 14;
        } else {
          passed.push('✅ **Descripción**: Buena longitud (' + descLength + ' caracteres)');
          totalScore += 20;
        }

        // ── Análisis de la descripción SEO (meta description) ──
        maxScore += 10;
        const seoDesc = product.seoDescription;
        if (!seoDesc) {
          warnings.push('⚠️ **Meta descripción**: No definida. Google generará una automáticamente');
          totalScore += 2;
        } else if (seoDesc.length < 70) {
          warnings.push('⚠️ **Meta descripción**: Demasiado corta (< 70 caracteres)');
          totalScore += 5;
        } else if (seoDesc.length > 160) {
          warnings.push('⚠️ **Meta descripción**: Demasiado larga (> 160 caracteres). Se truncará');
          totalScore += 7;
        } else {
          passed.push('✅ **Meta descripción**: Longitud óptima (' + seoDesc.length + ' caracteres)');
          totalScore += 10;
        }

        // ── Análisis de imágenes ──
        maxScore += 15;
        const images = product.images;
        if (images.length === 0) {
          issues.push('❌ **Imágenes**: No tiene imágenes. Los productos sin imágenes tienen muy poca conversión');
        } else {
          let withAlt = 0;
          let withoutAlt = 0;

          for (const img of images) {
            if (img.alt && img.alt.trim().length > 0) {
              withAlt++;
            } else {
              withoutAlt++;
            }
          }

          if (withoutAlt > 0) {
            warnings.push(`⚠️ **Imágenes**: ${withoutAlt} de ${images.length} imagen(es) sin texto alternativo (alt)`);
            totalScore += Math.round((withAlt / images.length) * 10);
          } else {
            passed.push(`✅ **Imágenes**: ${images.length} imagen(es), todas con texto alternativo`);
            totalScore += 15;
          }

          if (images.length < 3) {
            warnings.push('⚠️ **Imágenes**: Se recomiendan al menos 3 imágenes para mejorar la conversión');
          }
        }

        // ── Análisis de tags ──
        maxScore += 10;
        const tags = product.tags;
        if (tags.length === 0) {
          warnings.push('⚠️ **Tags**: No tiene tags. Agrega etiquetas relevantes para categorización y búsqueda');
          totalScore += 2;
        } else if (tags.length < 3) {
          warnings.push(`⚠️ **Tags**: Solo ${tags.length} tag(s). Se recomiendan al menos 3-5 tags relevantes`);
          totalScore += 5;
        } else {
          passed.push(`✅ **Tags**: ${tags.length} tags configurados (${tags.join(', ')})`);
          totalScore += 10;
        }

        // ── Análisis del slug ──
        maxScore += 5;
        if (!product.slug || product.slug.length === 0) {
          warnings.push('⚠️ **URL (slug)**: No definido');
        } else if (/[A-Z\s]/.test(product.slug)) {
          warnings.push('⚠️ **URL (slug)**: Contiene mayúsculas o espacios. Usa solo minúsculas y guiones');
          totalScore += 2;
        } else {
          passed.push('✅ **URL (slug)**: Formato correcto (' + product.slug + ')');
          totalScore += 5;
        }

        // ── Calcular puntuación final ──
        const percentage = Math.round((totalScore / maxScore) * 100);
        let grade: string;
        let gradeIcon: string;

        if (percentage >= 90) { grade = 'Excelente'; gradeIcon = '🏆'; }
        else if (percentage >= 75) { grade = 'Bueno'; gradeIcon = '✅'; }
        else if (percentage >= 50) { grade = 'Mejorable'; gradeIcon = '⚠️'; }
        else { grade = 'Deficiente'; gradeIcon = '❌'; }

        const lines: string[] = [
          `🔍 **Auditoría SEO — ${product.title}**`,
          ``,
          `## ${gradeIcon} Puntuación: ${percentage}/100 — ${grade}`,
          ``,
          `| Métrica | Detalle |`,
          `|---------|---------|`,
          `| Producto | ${product.title} (ID: ${product.id}) |`,
          `| Proveedor | ${params.provider} |`,
          `| Puntuación | ${totalScore}/${maxScore} puntos |`,
          ``,
        ];

        if (issues.length > 0) {
          lines.push(`### ❌ Problemas críticos (${issues.length})`, ...issues, ``);
        }

        if (warnings.length > 0) {
          lines.push(`### ⚠️ Advertencias (${warnings.length})`, ...warnings, ``);
        }

        if (passed.length > 0) {
          lines.push(`### ✅ Aprobados (${passed.length})`, ...passed, ``);
        }

        // Recomendaciones priorizadas
        const recommendations: string[] = [];
        if (issues.length > 0) {
          recommendations.push('1. **Prioridad alta**: Resuelve los problemas críticos marcados con ❌');
        }
        if (!seoTitle) {
          recommendations.push('2. Define un título SEO personalizado con tus keywords principales');
        }
        if (!seoDesc) {
          recommendations.push('3. Escribe una meta descripción atractiva de 120-155 caracteres');
        }
        if (images.length < 3) {
          recommendations.push('4. Agrega más imágenes de producto (mínimo 3 recomendadas)');
        }
        if (tags.length < 3) {
          recommendations.push('5. Agrega tags relevantes que tus clientes usarían para buscar este producto');
        }

        if (recommendations.length > 0) {
          lines.push(`### 💡 Recomendaciones`, ...recommendations);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al auditar SEO: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
