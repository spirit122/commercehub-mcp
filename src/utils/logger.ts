/**
 * @module logger
 * @description Logger estructurado basado en pino para CommerceHub MCP Server.
 * Proporciona JSON structured logging con campos automáticos de contexto,
 * sub-loggers y configuración desde variables de entorno.
 */

import pino from 'pino';
import type { ProviderName } from '../types/common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Niveles de log soportados. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Bindings de contexto para sub-loggers. */
export interface LoggerBindings {
  /** Proveedor de e-commerce asociado. */
  provider?: ProviderName;
  /** Nombre de la operación en curso. */
  operation?: string;
  /** Campos adicionales de contexto. */
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el nivel de log desde la variable de entorno LOG_LEVEL.
 * Valores válidos: 'debug', 'info', 'warn', 'error'.
 * Si no está definido o es inválido, usa 'info' como fallback.
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env['LOG_LEVEL']?.toLowerCase();
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  if (envLevel && validLevels.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }

  return 'info';
}

// ─────────────────────────────────────────────────────────────────────────────
// Instancia raíz de pino
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logger raíz del sistema. Se configura una sola vez al importar el módulo.
 * Escribe a stderr para no interferir con la comunicación MCP por stdout.
 */
const rootLogger = pino({
  level: getLogLevel(),
  transport:
    process.env['NODE_ENV'] === 'development'
      ? {
          target: 'pino/file',
          options: { destination: 2 }, // stderr
        }
      : undefined,
  // En producción escribir a stderr directamente (formato JSON nativo de pino).
  ...(process.env['NODE_ENV'] !== 'development' && {
    destination: pino.destination(2),
  }),
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'commercehub-mcp',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Logger wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper tipado alrededor de pino que facilita la creación de sub-loggers
 * con contexto específico (proveedor, operación, etc.).
 *
 * @example
 * ```ts
 * const logger = createLogger('shopify-provider');
 * logger.info('Producto creado', { productId: '123' });
 *
 * const childLogger = logger.child({ operation: 'listProducts' });
 * childLogger.debug('Consultando API...');
 * ```
 */
export class Logger {
  private readonly pinoInstance: pino.Logger;

  constructor(pinoInstance: pino.Logger) {
    this.pinoInstance = pinoInstance;
  }

  /**
   * Log de nivel debug. Para información detallada de depuración.
   *
   * @param message - Mensaje descriptivo.
   * @param data - Datos adicionales de contexto.
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.pinoInstance.debug(data, message);
    } else {
      this.pinoInstance.debug(message);
    }
  }

  /**
   * Log de nivel info. Para eventos operacionales normales.
   *
   * @param message - Mensaje descriptivo.
   * @param data - Datos adicionales de contexto.
   */
  info(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.pinoInstance.info(data, message);
    } else {
      this.pinoInstance.info(message);
    }
  }

  /**
   * Log de nivel warn. Para situaciones inesperadas que no impiden la operación.
   *
   * @param message - Mensaje descriptivo.
   * @param data - Datos adicionales de contexto.
   */
  warn(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.pinoInstance.warn(data, message);
    } else {
      this.pinoInstance.warn(message);
    }
  }

  /**
   * Log de nivel error. Para errores que requieren atención.
   *
   * @param message - Mensaje descriptivo.
   * @param data - Datos adicionales de contexto.
   */
  error(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.pinoInstance.error(data, message);
    } else {
      this.pinoInstance.error(message);
    }
  }

  /**
   * Crea un sub-logger con bindings de contexto adicionales.
   * Los bindings se incluyen automáticamente en cada entrada de log.
   *
   * @param bindings - Campos de contexto adicionales (provider, operation, etc.).
   * @returns Nuevo Logger con el contexto extendido.
   *
   * @example
   * ```ts
   * const providerLogger = logger.child({ provider: 'shopify', operation: 'getProduct' });
   * providerLogger.info('Consultando producto...', { productId: '123' });
   * // Output incluye automáticamente provider y operation.
   * ```
   */
  child(bindings: LoggerBindings): Logger {
    return new Logger(this.pinoInstance.child(bindings));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un logger con nombre y contexto específico.
 * Es la forma recomendada de obtener un logger en cada módulo del sistema.
 *
 * @param name - Nombre del módulo o componente (ej. 'shopify-provider', 'product-tools').
 * @returns Instancia de Logger configurada.
 *
 * @example
 * ```ts
 * // En un módulo de proveedor
 * const logger = createLogger('shopify-provider');
 * logger.info('Inicializando proveedor...');
 *
 * // Logger hijo con contexto de operación
 * const opLogger = logger.child({ provider: 'shopify', operation: 'listProducts' });
 * opLogger.debug('Aplicando filtros', { filters: { status: 'active' } });
 * ```
 */
export function createLogger(name: string): Logger {
  return new Logger(rootLogger.child({ module: name }));
}
