/**
 * CommerceHub MCP - Tool Guard
 *
 * Wrapper que intercepta las llamadas a herramientas MCP
 * y verifica que el plan actual permita su uso.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../types/index.js';
import { getLicenseManager } from './license-manager.js';

type RegisterFunction = (
  server: McpServer,
  providers: Map<string, ICommerceProvider>,
) => void;

/**
 * Envuelve una función de registro de herramienta con verificación de licencia.
 * Si la herramienta no está disponible en el plan actual, muestra mensaje de upgrade.
 */
export function withLicenseGuard(
  toolName: string,
  registerFn: RegisterFunction,
): RegisterFunction {
  return (server: McpServer, providers: Map<string, ICommerceProvider>) => {
    const license = getLicenseManager();
    const access = license.checkToolAccess(toolName);

    if (!access.allowed) {
      // Registrar la tool pero que retorne mensaje de upgrade
      server.tool(
        toolName,
        `[PRO] Esta herramienta requiere upgrade - usa "license_plans" para ver opciones`,
        {},
        async () => ({
          content: [{ type: 'text', text: access.message }],
          isError: true,
        }),
      );
      return;
    }

    // Tool permitida: registrar normalmente
    registerFn(server, providers);
  };
}

/**
 * Envuelve múltiples funciones de registro con verificación de licencia.
 */
export function guardTools(
  tools: Array<{ name: string; register: RegisterFunction }>,
): Array<{ name: string; register: RegisterFunction }> {
  return tools.map(({ name, register }) => ({
    name,
    register: withLicenseGuard(name, register),
  }));
}
