/**
 * CommerceHub MCP - Planes y licencias
 *
 * Define los planes disponibles y qué herramientas incluye cada uno.
 */

/** Planes disponibles */
export type PlanType = 'free' | 'pro' | 'business';

/** Información de un plan */
export interface PlanInfo {
  name: string;
  displayName: string;
  price: string;
  maxProviders: number;
  maxRequestsPerDay: number;
  tools: Set<string>;
  features: string[];
}

/** Herramientas del plan FREE (15 tools - solo lectura básica) */
const FREE_TOOLS = new Set([
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
  // Analytics (4 - básicos)
  'analytics_revenue',
  'analytics_top_products',
  'analytics_avg_order',
  'analytics_dashboard',
]);

/** Herramientas del plan PRO (todas las 37 tools) */
const PRO_TOOLS = new Set([
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
]);

/** Herramientas del plan BUSINESS (todo lo de PRO + futuras) */
const BUSINESS_TOOLS = new Set([
  ...PRO_TOOLS,
]);

/** Definición completa de planes */
export const PLANS: Record<PlanType, PlanInfo> = {
  free: {
    name: 'free',
    displayName: 'Free',
    price: '$0',
    maxProviders: 1,
    maxRequestsPerDay: 100,
    tools: FREE_TOOLS,
    features: [
      '1 plataforma',
      '15 herramientas (solo lectura)',
      '100 requests/dia',
      'Analytics basicos',
      'Soporte community',
    ],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    price: '$49/mes',
    maxProviders: 5,
    maxRequestsPerDay: 10000,
    tools: PRO_TOOLS,
    features: [
      'Hasta 5 plataformas',
      '37 herramientas completas',
      '10,000 requests/dia',
      'Sync entre plataformas',
      'Analytics avanzados + forecast',
      'Segmentacion de clientes',
      'Soporte por email',
    ],
  },
  business: {
    name: 'business',
    displayName: 'Business',
    price: '$199/mes',
    maxProviders: Infinity,
    maxRequestsPerDay: Infinity,
    tools: BUSINESS_TOOLS,
    features: [
      'Plataformas ilimitadas',
      'Todas las herramientas',
      'Requests ilimitados',
      'Todo lo de Pro',
      'Multi-tienda ilimitada',
      'API priority',
      'Soporte prioritario',
    ],
  },
};

/**
 * Obtiene la información de un plan por nombre.
 */
export function getPlan(plan: PlanType): PlanInfo {
  return PLANS[plan];
}

/**
 * Verifica si una herramienta está disponible en un plan.
 */
export function isToolAvailable(toolName: string, plan: PlanType): boolean {
  return PLANS[plan].tools.has(toolName);
}

/**
 * Obtiene las herramientas bloqueadas para un plan (las que necesita upgrade).
 */
export function getBlockedTools(plan: PlanType): string[] {
  if (plan === 'business') return [];
  const allTools = PLANS.business.tools;
  const planTools = PLANS[plan].tools;
  return [...allTools].filter((t) => !planTools.has(t));
}

/**
 * Retorna el plan mínimo necesario para usar una herramienta.
 */
export function getMinimumPlan(toolName: string): PlanType {
  if (PLANS.free.tools.has(toolName)) return 'free';
  if (PLANS.pro.tools.has(toolName)) return 'pro';
  return 'business';
}
