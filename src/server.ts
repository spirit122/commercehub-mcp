/**
 * CommerceHub MCP - Servidor principal
 *
 * Registra todas las herramientas, recursos y prompts del servidor MCP.
 * Inicializa los proveedores configurados.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from './types/index.js';
import { loadConfig, validateConfig, getConfiguredProviders } from './config.js';
import { getLicenseManager, PLANS, withLicenseGuard } from './licensing/index.js';
import { z } from 'zod';

// --- Providers ---
import { ShopifyProvider } from './providers/shopify/shopify.provider.js';
import { WooCommerceProvider } from './providers/woocommerce/woo.provider.js';
import { StripeProvider } from './providers/stripe/stripe.provider.js';
import { MeliProvider } from './providers/mercadolibre/meli.provider.js';

// --- Tools: Products ---
import { registerListProducts } from './tools/products/list-products.js';
import { registerGetProduct } from './tools/products/get-product.js';
import { registerCreateProduct } from './tools/products/create-product.js';
import { registerUpdateProduct } from './tools/products/update-product.js';
import { registerDeleteProduct } from './tools/products/delete-product.js';
import { registerSearchProducts } from './tools/products/search-products.js';
import { registerBulkUpdatePrices } from './tools/products/bulk-update-prices.js';
import { registerSyncProducts } from './tools/products/sync-products.js';
import { registerProductSeoAudit } from './tools/products/generate-description.js';

// --- Tools: Orders ---
import { registerListOrders } from './tools/orders/list-orders.js';
import { registerGetOrder } from './tools/orders/get-order.js';
import { registerCreateOrder } from './tools/orders/create-order.js';
import { registerFulfillOrder } from './tools/orders/fulfill-order.js';
import { registerCancelOrder } from './tools/orders/cancel-order.js';
import { registerRefundOrder } from './tools/orders/refund-order.js';
import { registerOrderNotes } from './tools/orders/order-notes.js';
import { registerOrderTimeline } from './tools/orders/order-timeline.js';

// --- Tools: Inventory ---
import { registerGetInventory } from './tools/inventory/get-inventory.js';
import { registerUpdateInventory } from './tools/inventory/update-inventory.js';
import { registerBulkInventory } from './tools/inventory/bulk-inventory.js';
import { registerLowStockReport } from './tools/inventory/low-stock-report.js';
import { registerInventoryForecast } from './tools/inventory/inventory-forecast.js';
import { registerInventoryHistory } from './tools/inventory/inventory-history.js';

// --- Tools: Customers ---
import { registerListCustomers } from './tools/customers/list-customers.js';
import { registerGetCustomer } from './tools/customers/get-customer.js';
import { registerSearchCustomers } from './tools/customers/search-customers.js';
import { registerCustomerOrders } from './tools/customers/customer-orders.js';
import { registerCustomerSegments } from './tools/customers/customer-segments.js';
import { registerCustomerLifetimeValue } from './tools/customers/customer-lifetime.js';

// --- Tools: Analytics ---
import { registerRevenueReport } from './tools/analytics/revenue-report.js';
import { registerTopProducts } from './tools/analytics/top-products.js';
import { registerSalesByChannel } from './tools/analytics/sales-by-channel.js';
import { registerConversionFunnel } from './tools/analytics/conversion-funnel.js';
import { registerAverageOrderValue } from './tools/analytics/average-order-value.js';
import { registerSalesForecast } from './tools/analytics/sales-forecast.js';
import { registerRefundAnalysis } from './tools/analytics/refund-analysis.js';
import { registerDashboardSummary } from './tools/analytics/dashboard-summary.js';

// --- Resources ---
import { registerStoreInfoResource } from './resources/store-info.js';
import { registerRecentOrdersResource } from './resources/recent-orders.js';
import { registerInventoryAlertsResource } from './resources/inventory-alerts.js';

// --- Prompts ---
import { registerDailyReportPrompt } from './prompts/daily-report.js';
import { registerOrderSummaryPrompt } from './prompts/order-summary.js';
import { registerInventoryCheckPrompt } from './prompts/inventory-check.js';

/**
 * Crea y configura el servidor MCP de CommerceHub.
 */
export async function createServer(): Promise<McpServer> {
  // Cargar y validar configuración
  const config = loadConfig();
  const validation = validateConfig(config);

  // Crear servidor MCP
  const server = new McpServer({
    name: 'CommerceHub',
    version: '1.0.0',
    description:
      'Plataforma de operaciones e-commerce multi-plataforma. ' +
      'Gestiona productos, órdenes, inventario, clientes y analytics ' +
      'de Shopify, WooCommerce, Stripe y MercadoLibre desde un solo lugar.',
  });

  // Inicializar proveedores
  const providers = new Map<string, ICommerceProvider>();

  const providerFactories: Record<string, () => ICommerceProvider> = {
    shopify: () => new ShopifyProvider(),
    woocommerce: () => new WooCommerceProvider(),
    stripe: () => new StripeProvider(),
    mercadolibre: () => new MeliProvider(),
  };

  const configuredNames = getConfiguredProviders(config);

  for (const name of configuredNames) {
    const providerConfig = config.providers.get(name);
    if (!providerConfig) continue;

    const factory = providerFactories[name];
    if (!factory) continue;

    try {
      const provider = factory();
      await provider.initialize(providerConfig);
      providers.set(name, provider);
    } catch (error) {
      console.error(
        `[CommerceHub] Error inicializando proveedor ${name}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Si no hay proveedores, registrar herramienta informativa
  if (providers.size === 0) {
    server.tool(
      'setup_help',
      'Muestra instrucciones de configuración de CommerceHub',
      {},
      async () => ({
        content: [
          {
            type: 'text',
            text: validation.message,
          },
        ],
      }),
    );
  }

  // =============================================
  // Sistema de licencias
  // =============================================
  const license = getLicenseManager();
  const plan = license.getPlan();
  const planInfo = license.getPlanInfo();

  // Verificar límite de proveedores
  if (providers.size > planInfo.maxProviders) {
    const extra = Array.from(providers.keys()).slice(planInfo.maxProviders);
    for (const name of extra) {
      providers.delete(name);
    }
    console.error(
      `[CommerceHub] Plan ${planInfo.displayName} permite max ${planInfo.maxProviders} proveedor(es). Se desactivaron: ${extra.join(', ')}. Upgrade en https://commercehub.gumroad.com`,
    );
  }

  // Tool: Ver plan actual y estado de licencia
  server.tool(
    'license_status',
    'Muestra el plan actual, herramientas disponibles y estado de la licencia',
    {},
    async () => {
      const status = license.getStatus();
      const blocked = plan === 'free' ? 22 : plan === 'pro' ? 0 : 0;
      const lines = [
        '=== CommerceHub - Estado de Licencia ===',
        '',
        `Plan: ${status.planInfo.displayName} (${status.planInfo.price})`,
        `License Key: ${status.licenseKey ?? 'No configurada (plan Free)'}`,
        `Expira: ${status.expiresAt ?? 'N/A'}`,
        `Requests hoy: ${status.requestsToday} / ${status.requestsLimit === Infinity ? 'ilimitados' : status.requestsLimit}`,
        `Proveedores: ${providers.size} / ${status.planInfo.maxProviders === Infinity ? 'ilimitados' : status.planInfo.maxProviders}`,
        '',
        `Herramientas disponibles: ${status.planInfo.tools.size}`,
        `Herramientas bloqueadas: ${blocked}`,
        '',
        'Caracteristicas de tu plan:',
        ...status.planInfo.features.map((f) => `  - ${f}`),
      ];

      if (plan === 'free') {
        lines.push(
          '',
          '--- UPGRADE ---',
          '',
          'Pro ($49/mes): 37 tools + sync + analytics avanzados',
          'Business ($199/mes): Todo ilimitado + soporte prioritario',
          '',
          'Compra en: https://commercehub.gumroad.com',
          'Activa con: COMMERCEHUB_LICENSE_KEY=CHUB-XXXX-XXXX-XXXX-XXXX',
        );
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // Tool: Activar licencia
  server.tool(
    'license_activate',
    'Activa una license key de CommerceHub Pro o Business',
    {
      license_key: z.string().describe('License key en formato CHUB-XXXX-XXXX-XXXX-XXXX'),
    },
    async (params) => {
      const result = license.activate(params.license_key);
      const lines = [
        result.valid ? 'Licencia activada exitosamente!' : 'Error al activar licencia',
        '',
        result.message,
      ];

      if (result.valid) {
        lines.push(
          '',
          'Reinicia el servidor MCP para aplicar todos los cambios.',
          'Agrega la key a tus variables de entorno para que persista:',
          `  COMMERCEHUB_LICENSE_KEY=${params.license_key}`,
        );
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        isError: !result.valid,
      };
    },
  );

  // Tool: Ver planes disponibles
  server.tool(
    'license_plans',
    'Muestra los planes disponibles y sus precios',
    {},
    async () => {
      const currentPlan = license.getPlan();
      const lines = [
        '=== CommerceHub - Planes ===',
        '',
      ];

      for (const [key, p] of Object.entries(PLANS)) {
        const isCurrent = key === currentPlan;
        lines.push(
          `${isCurrent ? '>> ' : '   '}${p.displayName} (${p.price})${isCurrent ? ' << TU PLAN ACTUAL' : ''}`,
        );
        for (const f of p.features) {
          lines.push(`      - ${f}`);
        }
        lines.push('');
      }

      lines.push(
        'Compra en: https://commercehub.gumroad.com',
        '',
        'Despues de comprar, activa con:',
        '  Usa la herramienta "license_activate" con tu key',
        '  O agrega la variable: COMMERCEHUB_LICENSE_KEY=tu-key',
      );

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // =============================================
  // Registrar todas las herramientas (37 tools)
  // Cada tool pasa por el license guard
  // =============================================

  // Products (9) - 3 free, 6 pro
  withLicenseGuard('products_list', registerListProducts)(server, providers);
  withLicenseGuard('products_get', registerGetProduct)(server, providers);
  withLicenseGuard('products_search', registerSearchProducts)(server, providers);
  withLicenseGuard('products_create', registerCreateProduct)(server, providers);
  withLicenseGuard('products_update', registerUpdateProduct)(server, providers);
  withLicenseGuard('products_delete', registerDeleteProduct)(server, providers);
  withLicenseGuard('products_bulk_price', registerBulkUpdatePrices)(server, providers);
  withLicenseGuard('products_sync', registerSyncProducts)(server, providers);
  withLicenseGuard('products_seo_audit', registerProductSeoAudit)(server, providers);

  // Orders (8) - 3 free, 5 pro
  withLicenseGuard('orders_list', registerListOrders)(server, providers);
  withLicenseGuard('orders_get', registerGetOrder)(server, providers);
  withLicenseGuard('orders_timeline', registerOrderTimeline)(server, providers);
  withLicenseGuard('orders_create', registerCreateOrder)(server, providers);
  withLicenseGuard('orders_fulfill', registerFulfillOrder)(server, providers);
  withLicenseGuard('orders_cancel', registerCancelOrder)(server, providers);
  withLicenseGuard('orders_refund', registerRefundOrder)(server, providers);
  withLicenseGuard('orders_add_note', registerOrderNotes)(server, providers);

  // Inventory (6) - 2 free, 4 pro
  withLicenseGuard('inventory_get', registerGetInventory)(server, providers);
  withLicenseGuard('inventory_low_stock', registerLowStockReport)(server, providers);
  withLicenseGuard('inventory_update', registerUpdateInventory)(server, providers);
  withLicenseGuard('inventory_bulk', registerBulkInventory)(server, providers);
  withLicenseGuard('inventory_forecast', registerInventoryForecast)(server, providers);
  withLicenseGuard('inventory_history', registerInventoryHistory)(server, providers);

  // Customers (6) - 3 free, 3 pro
  withLicenseGuard('customers_list', registerListCustomers)(server, providers);
  withLicenseGuard('customers_get', registerGetCustomer)(server, providers);
  withLicenseGuard('customers_search', registerSearchCustomers)(server, providers);
  withLicenseGuard('customers_orders', registerCustomerOrders)(server, providers);
  withLicenseGuard('customers_segments', registerCustomerSegments)(server, providers);
  withLicenseGuard('customers_lifetime_value', registerCustomerLifetimeValue)(server, providers);

  // Analytics (8) - 4 free, 4 pro
  withLicenseGuard('analytics_revenue', registerRevenueReport)(server, providers);
  withLicenseGuard('analytics_top_products', registerTopProducts)(server, providers);
  withLicenseGuard('analytics_avg_order', registerAverageOrderValue)(server, providers);
  withLicenseGuard('analytics_dashboard', registerDashboardSummary)(server, providers);
  withLicenseGuard('analytics_by_channel', registerSalesByChannel)(server, providers);
  withLicenseGuard('analytics_conversion', registerConversionFunnel)(server, providers);
  withLicenseGuard('analytics_forecast', registerSalesForecast)(server, providers);
  withLicenseGuard('analytics_refunds', registerRefundAnalysis)(server, providers);

  // =============================================
  // Registrar recursos (3 resources)
  // =============================================
  registerStoreInfoResource(server, providers);
  registerRecentOrdersResource(server, providers);
  registerInventoryAlertsResource(server, providers);

  // =============================================
  // Registrar prompts (3 prompts)
  // =============================================
  registerDailyReportPrompt(server);
  registerOrderSummaryPrompt(server);
  registerInventoryCheckPrompt(server);

  // Log de inicio
  const providerNames = Array.from(providers.keys());
  console.error(
    `[CommerceHub] Servidor iniciado | Plan: ${planInfo.displayName} (${planInfo.price}) | Proveedores: ${providerNames.length > 0 ? providerNames.join(', ') : 'ninguno'} | Tools: ${planInfo.tools.size + 3} (${37 - planInfo.tools.size} bloqueadas) | Resources: 3 | Prompts: 3`,
  );

  return server;
}
