#!/usr/bin/env node

/**
 * CommerceHub MCP Server
 *
 * Servidor MCP para operaciones de e-commerce multi-plataforma.
 * Conecta agentes de IA con Shopify, WooCommerce, Stripe y MercadoLibre.
 *
 * @author CommerceHub
 * @version 1.0.0
 * @license MIT
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main() {
  try {
    // Crear servidor MCP
    const server = await createServer();

    // Conectar via stdio (compatible con Claude Desktop, Claude Code, etc.)
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('[CommerceHub] Conectado via stdio - listo para recibir comandos');

    // Manejo graceful de señales
    const shutdown = async () => {
      console.error('[CommerceHub] Apagando servidor...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[CommerceHub] Error fatal:', error);
    process.exit(1);
  }
}

main();
