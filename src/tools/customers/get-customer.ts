/**
 * @module tools/customers/get-customer
 * @description Herramienta MCP para obtener el perfil completo de un cliente
 * incluyendo estadísticas, direcciones y segmento.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../../types/index.js';

/**
 * Registra la herramienta `customers_get` en el servidor MCP.
 *
 * @param server - Instancia del servidor MCP.
 * @param providers - Mapa de proveedores de comercio configurados.
 */
export function registerGetCustomer(server: McpServer, providers: Map<string, ICommerceProvider>) {
  server.tool(
    'customers_get',
    'Obtiene el perfil completo de un cliente con estadísticas, direcciones y segmento',
    {
      provider: z.enum(['shopify', 'woocommerce', 'stripe', 'mercadolibre']).describe('Plataforma de e-commerce'),
      customer_id: z.string().describe('Identificador del cliente'),
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
        const customer = await prov.getCustomer(params.customer_id);

        const segmentIcon = (s: string) => {
          switch (s) {
            case 'VIP': return '👑';
            case 'CHAMPION': return '🏆';
            case 'REGULAR': return '👤';
            case 'NEW': return '🆕';
            case 'AT_RISK': return '⚠️';
            case 'LOST': return '💤';
            default: return '❓';
          }
        };

        const lines: string[] = [
          `👤 **Perfil de Cliente**\n`,
          '─'.repeat(50),
          `📛 **Nombre:** ${customer.firstName} ${customer.lastName}`,
          `📧 **Email:** ${customer.email}`,
        ];

        if (customer.phone) lines.push(`📞 **Teléfono:** ${customer.phone}`);
        if (customer.company) lines.push(`🏢 **Empresa:** ${customer.company}`);

        lines.push(`🏷️ **Segmento:** ${segmentIcon(customer.segment)} ${customer.segment}`);
        lines.push(`📣 **Acepta marketing:** ${customer.acceptsMarketing ? '✅ Sí' : '❌ No'}`);

        if (customer.tags.length > 0) {
          lines.push(`🏷️ **Tags:** ${customer.tags.join(', ')}`);
        }

        lines.push('');
        lines.push('─'.repeat(50));
        lines.push('📊 **Estadísticas de compra:**');
        lines.push(`  💰 Total gastado: ${customer.totalSpent.currency} ${customer.totalSpent.amount.toFixed(2)}`);
        lines.push(`  📦 Total órdenes: ${customer.totalOrders}`);
        lines.push(`  🧾 Ticket promedio: ${customer.averageOrderValue.currency} ${customer.averageOrderValue.amount.toFixed(2)}`);

        if (customer.firstOrderAt) {
          lines.push(`  📅 Primera compra: ${new Date(customer.firstOrderAt).toLocaleDateString('es-ES')}`);
        }
        if (customer.lastOrderAt) {
          lines.push(`  📅 Última compra: ${new Date(customer.lastOrderAt).toLocaleDateString('es-ES')}`);
          const daysSince = Math.floor((Date.now() - new Date(customer.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24));
          lines.push(`  ⏱️ Días desde última compra: ${daysSince}`);
        }

        if (customer.addresses.length > 0) {
          lines.push('');
          lines.push('─'.repeat(50));
          lines.push(`📍 **Direcciones (${customer.addresses.length}):**`);
          for (const [i, addr] of customer.addresses.entries()) {
            const addrParts = [addr.address1, addr.address2, addr.city, addr.province, addr.zip, addr.country].filter(Boolean);
            lines.push(`  ${i + 1}. ${addrParts.join(', ')}`);
          }
        }

        lines.push('');
        lines.push('─'.repeat(50));
        lines.push(`🆔 **ID:** ${customer.id} | **ID Externo:** ${customer.externalId}`);
        lines.push(`📅 **Registrado:** ${new Date(customer.createdAt).toLocaleDateString('es-ES')}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error al obtener cliente: ${error instanceof Error ? error.message : 'Error desconocido'}` }],
          isError: true,
        };
      }
    }
  );
}
