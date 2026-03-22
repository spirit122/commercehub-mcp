# Guia para agregar proveedores - CommerceHub MCP

## Arquitectura de Proveedores

CommerceHub usa el **patron adaptador** para soportar multiples plataformas de e-commerce. Cada proveedor implementa la interfaz `ICommerceProvider` que define un contrato unificado para todas las operaciones.

```
ICommerceProvider (interfaz)
    |
    +-- BaseProvider (clase abstracta - HTTP, cache, rate limiting)
          |
          +-- ShopifyProvider
          +-- WooCommerceProvider
          +-- StripeProvider
          +-- MercadoLibreProvider
          +-- TuNuevoProvider  <-- Lo que vas a crear
```

## Paso 1: Crear la estructura

```bash
mkdir -p src/providers/mi-proveedor
touch src/providers/mi-proveedor/mi-proveedor.provider.ts
touch src/providers/mi-proveedor/mi-proveedor.mapper.ts
touch src/providers/mi-proveedor/mi-proveedor.auth.ts
```

## Paso 2: Implementar el provider

```typescript
// src/providers/mi-proveedor/mi-proveedor.provider.ts
import { BaseProvider } from '../base.provider.js';
import type { ProviderName, Product, Order, Customer } from '../../types/index.js';

export class MiProveedorProvider extends BaseProvider {
  readonly name: ProviderName = 'mi-proveedor' as ProviderName;

  protected buildUrl(path: string): string {
    return `https://api.mi-proveedor.com/v1${path}`;
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  // Implementar los metodos que necesites...
  // Los metodos no implementados lanzaran "not implemented"
}
```

## Paso 3: Implementar el mapper

```typescript
// src/providers/mi-proveedor/mi-proveedor.mapper.ts
import type { Product, Order } from '../../types/index.js';

export function mapMiProveedorProduct(raw: any): Product {
  return {
    id: String(raw.id),
    externalId: String(raw.id),
    provider: 'mi-proveedor' as any,
    title: raw.nombre,
    // ... mapear todos los campos
  };
}
```

## Paso 4: Registrar en server.ts

```typescript
// En src/server.ts, agrega:
import { MiProveedorProvider } from './providers/mi-proveedor/mi-proveedor.provider.js';

// En providerFactories:
const providerFactories = {
  // ... existentes
  'mi-proveedor': () => new MiProveedorProvider(),
};
```

## Paso 5: Agregar config en config.ts

```typescript
// En src/config.ts, agrega:
if (env.MI_PROVEEDOR_API_KEY) {
  providers.set('mi-proveedor' as ProviderName, {
    apiKey: env.MI_PROVEEDOR_API_KEY,
    storeUrl: env.MI_PROVEEDOR_URL,
  });
}
```

## Metodos del provider

Estos son los metodos que puedes implementar. No es necesario implementar todos - los no implementados retornaran error "not implemented":

### Productos
- `listProducts(filters, pagination)` - Listar productos
- `getProduct(id)` - Obtener producto por ID
- `createProduct(input)` - Crear producto
- `updateProduct(id, input)` - Actualizar producto
- `deleteProduct(id)` - Eliminar producto
- `searchProducts(query, filters)` - Buscar productos

### Ordenes
- `listOrders(filters, pagination)` - Listar ordenes
- `getOrder(id)` - Obtener orden
- `createOrder(input)` - Crear orden
- `fulfillOrder(input)` - Marcar como enviada
- `cancelOrder(id, reason, restock)` - Cancelar
- `refundOrder(input)` - Reembolsar
- `addOrderNote(orderId, note)` - Agregar nota
- `getOrderTimeline(orderId)` - Timeline

### Inventario
- `getInventory(sku)` - Stock actual
- `updateInventory(update)` - Actualizar stock
- `bulkUpdateInventory(updates)` - Masivo
- `getInventoryHistory(sku, dateRange)` - Historial

### Clientes
- `listCustomers(filters, pagination)` - Listar
- `getCustomer(id)` - Obtener
- `searchCustomers(query)` - Buscar
- `getCustomerOrders(customerId, pagination)` - Ordenes del cliente

### Analytics
- `getRevenue(period)` - Ingresos
- `getTopProducts(period, limit)` - Mas vendidos
- `getConversionFunnel(period)` - Embudo
