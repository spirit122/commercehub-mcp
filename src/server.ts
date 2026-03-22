/**
 * CommerceHub MCP - Servidor principal
 *
 * Registra todas las herramientas, recursos y prompts del servidor MCP.
 * Inicializa los proveedores configurados.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ICommerceProvider } from './types/index.js';
import { loadConfig, validateConfig, getConfiguredProviders } from './config.js';

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
  // Registrar todas las herramientas (35 tools)
  // =============================================

  // Products (9)
  registerListProducts(server, providers);
  registerGetProduct(server, providers);
  registerCreateProduct(server, providers);
  registerUpdateProduct(server, providers);
  registerDeleteProduct(server, providers);
  registerSearchProducts(server, providers);
  registerBulkUpdatePrices(server, providers);
  registerSyncProducts(server, providers);
  registerProductSeoAudit(server, providers);

  // Orders (8)
  registerListOrders(server, providers);
  registerGetOrder(server, providers);
  registerCreateOrder(server, providers);
  registerFulfillOrder(server, providers);
  registerCancelOrder(server, providers);
  registerRefundOrder(server, providers);
  registerOrderNotes(server, providers);
  registerOrderTimeline(server, providers);

  // Inventory (6)
  registerGetInventory(server, providers);
  registerUpdateInventory(server, providers);
  registerBulkInventory(server, providers);
  registerLowStockReport(server, providers);
  registerInventoryForecast(server, providers);
  registerInventoryHistory(server, providers);

  // Customers (6)
  registerListCustomers(server, providers);
  registerGetCustomer(server, providers);
  registerSearchCustomers(server, providers);
  registerCustomerOrders(server, providers);
  registerCustomerSegments(server, providers);
  registerCustomerLifetimeValue(server, providers);

  // Analytics (8)
  registerRevenueReport(server, providers);
  registerTopProducts(server, providers);
  registerSalesByChannel(server, providers);
  registerConversionFunnel(server, providers);
  registerAverageOrderValue(server, providers);
  registerSalesForecast(server, providers);
  registerRefundAnalysis(server, providers);
  registerDashboardSummary(server, providers);

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
    `[CommerceHub] Servidor iniciado | Proveedores: ${providerNames.length > 0 ? providerNames.join(', ') : 'ninguno'} | Tools: 37 | Resources: 3 | Prompts: 3`,
  );

  return server;
}
