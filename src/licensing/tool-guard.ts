/**
 * CommerceHub MCP - Tool Guard mejorado
 *
 * Wrapper que intercepta las llamadas a herramientas MCP
 * y verifica que el plan actual permita su uso.
 *
 * Verificaciones realizadas:
 * - Plan permite la herramienta
 * - Licencia no ha expirado
 * - Limite diario de requests no excedido
 * - No se ha detectado tampering en el sistema
 * - Grace period (agrega warnings si aplica)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from '../types/index.js';
import { getLicenseManager } from './license-manager.js';

/** Tipo de la funcion que registra una herramienta en el servidor MCP */
type RegisterFunction = (
  server: McpServer,
  providers: Map<string, ICommerceProvider>,
) => void;

/**
 * Envuelve una funcion de registro de herramienta con verificacion de licencia.
 *
 * Cuando la herramienta no esta disponible en el plan actual, se registra
 * de todas formas pero retorna un mensaje de upgrade al ser invocada.
 *
 * Cuando la herramienta esta disponible pero hay warnings (ej: grace period),
 * se agrega el warning al resultado de la herramienta.
 *
 * @param toolName - Nombre de la herramienta a proteger
 * @param registerFn - Funcion original de registro de la herramienta
 * @returns Funcion de registro envuelta con verificacion de licencia
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
        `[UPGRADE REQUERIDO] Esta herramienta requiere un plan superior - usa "license_status" para ver opciones`,
        {},
        async () => ({
          content: [{ type: 'text' as const, text: access.message }],
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
 * Crea un guard que verifica acceso en runtime (en cada llamada).
 *
 * A diferencia de withLicenseGuard que verifica al registrar,
 * este wrapper verifica en cada invocacion de la herramienta.
 * Esto es util para detectar cambios en el plan durante la sesion
 * (ej: expiracion de licencia, fin de grace period).
 *
 * @param toolName - Nombre de la herramienta a proteger
 * @param handler - Handler original de la herramienta
 * @returns Handler envuelto con verificacion en runtime
 */
export function withRuntimeGuard<TArgs extends Record<string, unknown>>(
  toolName: string,
  handler: (args: TArgs) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>,
): (args: TArgs) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  return async (args: TArgs) => {
    const license = getLicenseManager();
    const access = license.checkToolAccess(toolName);

    if (!access.allowed) {
      return {
        content: [{ type: 'text' as const, text: access.message }],
        isError: true,
      };
    }

    // Ejecutar handler original
    const result = await handler(args);

    // Agregar warning de grace period si existe
    if (access.warning && result.content.length > 0) {
      result.content.push({
        type: 'text' as const,
        text: `\n---\n⚠ ${access.warning}`,
      });
    }

    return result;
  };
}

/**
 * Envuelve multiples funciones de registro con verificacion de licencia.
 *
 * @param tools - Array de herramientas con nombre y funcion de registro
 * @returns Array con las funciones de registro protegidas
 */
export function guardTools(
  tools: Array<{ name: string; register: RegisterFunction }>,
): Array<{ name: string; register: RegisterFunction }> {
  return tools.map(({ name, register }) => ({
    name,
    register: withLicenseGuard(name, register),
  }));
}
