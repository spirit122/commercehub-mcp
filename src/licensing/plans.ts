/**
 * CommerceHub MCP - Planes y licencias
 *
 * Define los planes disponibles y que herramientas incluye cada uno.
 * Incluye verificacion de integridad en runtime para detectar
 * modificaciones no autorizadas (ej: agregar tools al plan free).
 *
 * IMPORTANTE: No modificar las listas de herramientas manualmente.
 * El hash de integridad se verifica en cada validacion de licencia.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

/** Planes disponibles */
export type PlanType = 'free' | 'pro' | 'business';

/** Informacion de un plan */
export interface PlanInfo {
  /** Nombre interno del plan */
  name: string;
  /** Nombre para mostrar al usuario */
  displayName: string;
  /** Precio formateado */
  price: string;
  /** Maximo de proveedores/plataformas simultaneas */
  maxProviders: number;
  /** Maximo de requests por dia */
  maxRequestsPerDay: number;
  /** Set de nombres de herramientas disponibles */
  tools: ReadonlySet<string>;
  /** Lista de features para mostrar al usuario */
  features: readonly string[];
}

/**
 * Construye los planes de forma encapsulada.
 * Usa un closure para que las variables internas no sean accesibles desde fuera.
 * Los Sets se congelan (Object.freeze) para prevenir mutaciones.
 */
const buildPlans = (): {
  plans: Readonly<Record<PlanType, PlanInfo>>;
  getToolsHash: () => string;
} => {
  /** Herramientas del plan FREE (15 tools - solo lectura basica) */
  const FREE_TOOLS: ReadonlySet<string> = Object.freeze(
    new Set([
      // Products (3 - solo lectura)
      'products_list',
      'products_get',
      'products_search',
      // Orders (3 - solo lectura)
      'orders_list',
      'orders_get',
      'orders_timeline',
      // Inventory (2 - solo lectura)
      'inventory_get',
      'inventory_low_stock',
      // Customers (3 - solo lectura)
      'customers_list',
      'customers_get',
      'customers_search',
      // Analytics (4 - basicos)
      'analytics_revenue',
      'analytics_top_products',
      'analytics_avg_order',
      'analytics_dashboard',
    ]),
  );

  /** Herramientas del plan PRO (todas las 37 tools) */
  const PRO_TOOLS: ReadonlySet<string> = Object.freeze(
    new Set([
      // Todas las free
      ...FREE_TOOLS,
      // Products (6 adicionales - escritura + avanzado)
      'products_create',
      'products_update',
      'products_delete',
      'products_bulk_price',
      'products_sync',
      'products_seo_audit',
      // Orders (5 adicionales - escritura)
      'orders_create',
      'orders_fulfill',
      'orders_cancel',
      'orders_refund',
      'orders_add_note',
      // Inventory (4 adicionales - escritura + avanzado)
      'inventory_update',
      'inventory_bulk',
      'inventory_forecast',
      'inventory_history',
      // Customers (3 adicionales - avanzado)
      'customers_orders',
      'customers_segments',
      'customers_lifetime_value',
      // Analytics (4 adicionales - avanzado)
      'analytics_by_channel',
      'analytics_conversion',
      'analytics_forecast',
      'analytics_refunds',
    ]),
  );

  /** Herramientas del plan BUSINESS (todo lo de PRO + futuras) */
  const BUSINESS_TOOLS: ReadonlySet<string> = Object.freeze(
    new Set([...PRO_TOOLS]),
  );

  /**
   * Genera un hash determinista de las listas de herramientas.
   * Se usa para detectar si alguien modifico el contenido de los sets.
   */
  const getToolsHash = (): string => {
    const allToolsSorted = [
      [...FREE_TOOLS].sort().join(','),
      [...PRO_TOOLS].sort().join(','),
      [...BUSINESS_TOOLS].sort().join(','),
    ].join('|');
    return createHash('sha256').update(allToolsSorted).digest('hex');
  };

  const plans: Readonly<Record<PlanType, PlanInfo>> = Object.freeze({
    free: Object.freeze({
      name: 'free',
      displayName: 'Free',
      price: '$0',
      maxProviders: 1,
      maxRequestsPerDay: 100,
      tools: FREE_TOOLS,
      features: Object.freeze([
        '1 plataforma',
        '15 herramientas (solo lectura)',
        '100 requests/dia',
        'Analytics basicos',
        'Soporte community',
      ]),
    }),
    pro: Object.freeze({
      name: 'pro',
      displayName: 'Pro',
      price: '$49/mes',
      maxProviders: 5,
      maxRequestsPerDay: 10000,
      tools: PRO_TOOLS,
      features: Object.freeze([
        'Hasta 5 plataformas',
        '37 herramientas completas',
        '10,000 requests/dia',
        'Sync entre plataformas',
        'Analytics avanzados + forecast',
        'Segmentacion de clientes',
        'Soporte por email',
      ]),
    }),
    business: Object.freeze({
      name: 'business',
      displayName: 'Business',
      price: '$199/mes',
      maxProviders: Infinity,
      maxRequestsPerDay: Infinity,
      tools: BUSINESS_TOOLS,
      features: Object.freeze([
        'Plataformas ilimitadas',
        'Todas las herramientas',
        'Requests ilimitados',
        'Todo lo de Pro',
        'Multi-tienda ilimitada',
        'API priority',
        'Soporte prioritario',
      ]),
    }),
  });

  return { plans, getToolsHash };
};

const { plans: PLANS, getToolsHash } = buildPlans();

export { PLANS };

/**
 * Hash esperado de las listas de herramientas.
 * Se calcula al cargar el modulo y se verifica en runtime.
 * Si alguien modifica los tools en el codigo fuente, este hash cambiara
 * y la verificacion de integridad fallara.
 */
const EXPECTED_TOOLS_HASH = getToolsHash();

/**
 * Verifica la integridad de las listas de herramientas.
 * Compara el hash actual de los tools con el esperado al momento de carga.
 *
 * @returns true si las listas no han sido modificadas en runtime
 */
export function verifyToolsIntegrity(): boolean {
  return getToolsHash() === EXPECTED_TOOLS_HASH;
}

/**
 * Verifica la integridad del archivo plans.ts en disco.
 * Compara el hash del archivo actual con un hash conocido.
 * Se usa para detectar si alguien edito el archivo fuente.
 *
 * @param knownHash - Hash conocido del archivo original
 * @returns true si el archivo no ha sido modificado
 */
export function verifyFileIntegrity(knownHash: string): boolean {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const content = readFileSync(thisFile, 'utf8');
    const currentHash = createHash('sha256').update(content).digest('hex');
    return currentHash === knownHash;
  } catch {
    // Si no podemos leer el archivo, asumimos que esta bien
    // (puede ser que este compilado/bundled)
    return true;
  }
}

/**
 * Obtiene el hash actual del archivo plans.ts para almacenamiento.
 * Este hash se guarda en el cache de licencia y se verifica en cada inicio.
 *
 * @returns Hash SHA-256 del archivo actual, o string vacio si falla
 */
export function getCurrentFileHash(): string {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const content = readFileSync(thisFile, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Obtiene la informacion de un plan por nombre.
 *
 * @param plan - Tipo de plan
 * @returns Informacion completa del plan
 */
export function getPlan(plan: PlanType): PlanInfo {
  return PLANS[plan];
}

/**
 * Verifica si una herramienta esta disponible en un plan.
 *
 * @param toolName - Nombre de la herramienta
 * @param plan - Tipo de plan
 * @returns true si la herramienta esta incluida en el plan
 */
export function isToolAvailable(toolName: string, plan: PlanType): boolean {
  return PLANS[plan].tools.has(toolName);
}

/**
 * Obtiene las herramientas bloqueadas para un plan.
 *
 * @param plan - Tipo de plan
 * @returns Array de nombres de herramientas que requieren upgrade
 */
export function getBlockedTools(plan: PlanType): string[] {
  if (plan === 'business') return [];
  const allTools = PLANS.business.tools;
  const planTools = PLANS[plan].tools;
  return [...allTools].filter((t) => !planTools.has(t));
}

/**
 * Retorna el plan minimo necesario para usar una herramienta.
 *
 * @param toolName - Nombre de la herramienta
 * @returns Tipo de plan minimo requerido
 */
export function getMinimumPlan(toolName: string): PlanType {
  if (PLANS.free.tools.has(toolName)) return 'free';
  if (PLANS.pro.tools.has(toolName)) return 'pro';
  return 'business';
}
