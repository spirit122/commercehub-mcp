/**
 * @module currency
 * @description Utilidades para manejo de valores monetarios en CommerceHub MCP Server.
 * Proporciona funciones para formatear, parsear, sumar, multiplicar y comparar
 * valores monetarios con validación de moneda consistente.
 */

import type { Money } from '../types/common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Símbolos de moneda para las divisas más comunes.
 * Clave: código ISO 4217, Valor: símbolo de la moneda.
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  JPY: '\u00A5',
  CNY: '\u00A5',
  ARS: '$',
  MXN: '$',
  BRL: 'R$',
  CLP: '$',
  COP: '$',
  PEN: 'S/',
  UYU: '$U',
  CAD: 'CA$',
  AUD: 'A$',
  NZD: 'NZ$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'z\u0142',
  CZK: 'K\u010D',
  HUF: 'Ft',
  TRY: '\u20BA',
  INR: '\u20B9',
  KRW: '\u20A9',
  THB: '\u0E3F',
  ZAR: 'R',
  ILS: '\u20AA',
  SGD: 'S$',
  HKD: 'HK$',
  TWD: 'NT$',
  PHP: '\u20B1',
  MYR: 'RM',
  IDR: 'Rp',
  VND: '\u20AB',
};

/**
 * Monedas que no usan decimales (cantidad de dígitos decimales = 0).
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'CLP', 'HUF', 'ISK', 'PYG', 'RWF',
  'UGX', 'BIF', 'DJF', 'GNF', 'KMF', 'MGA', 'XAF', 'XOF', 'XPF',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene la cantidad de dígitos decimales para una moneda.
 *
 * @param currency - Código ISO 4217 de la moneda.
 * @returns Cantidad de dígitos decimales (0 o 2).
 */
function getDecimalDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

/**
 * Redondea un monto monetario según los decimales de su moneda.
 *
 * @param amount - Monto a redondear.
 * @param currency - Código ISO 4217.
 * @returns Monto redondeado.
 */
function roundAmount(amount: number, currency: string): number {
  const digits = getDecimalDigits(currency);
  const factor = Math.pow(10, digits);
  return Math.round(amount * factor) / factor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones públicas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un valor monetario como string legible con símbolo y código de moneda.
 *
 * @param money - Valor monetario a formatear.
 * @returns String formateado (ej. "$1,234.56 USD").
 *
 * @example
 * ```ts
 * formatMoney({ amount: 1234.56, currency: 'USD' });
 * // → "$1,234.56 USD"
 *
 * formatMoney({ amount: 1500, currency: 'JPY' });
 * // → "¥1,500 JPY"
 *
 * formatMoney({ amount: 29.99, currency: 'EUR' });
 * // → "€29.99 EUR"
 * ```
 */
export function formatMoney(money: Money): string {
  const currency = money.currency.toUpperCase();
  const digits = getDecimalDigits(currency);
  const symbol = CURRENCY_SYMBOLS[currency] ?? '';

  const formatted = money.amount.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  return symbol ? `${symbol}${formatted} ${currency}` : `${formatted} ${currency}`;
}

/**
 * Crea un objeto Money a partir de un monto numérico y un código de moneda.
 * Redondea el monto según los decimales correspondientes a la moneda.
 *
 * @param amount - Monto numérico.
 * @param currency - Código ISO 4217 de la moneda (por defecto: 'USD').
 * @returns Objeto Money con monto redondeado.
 *
 * @example
 * ```ts
 * parseMoney(29.999);           // → { amount: 30.00, currency: 'USD' }
 * parseMoney(1500, 'JPY');      // → { amount: 1500, currency: 'JPY' }
 * parseMoney(19.995, 'EUR');    // → { amount: 20.00, currency: 'EUR' }
 * ```
 */
export function parseMoney(amount: number, currency: string = 'USD'): Money {
  const normalizedCurrency = currency.toUpperCase();
  return {
    amount: roundAmount(amount, normalizedCurrency),
    currency: normalizedCurrency,
  };
}

/**
 * Suma una lista de valores monetarios.
 * Todos los valores deben estar en la misma moneda.
 *
 * @param items - Lista de valores Money a sumar.
 * @returns Money con la suma total.
 * @throws Error si la lista está vacía o contiene monedas diferentes.
 *
 * @example
 * ```ts
 * sumMoney([
 *   { amount: 10.50, currency: 'USD' },
 *   { amount: 20.25, currency: 'USD' },
 *   { amount: 5.75, currency: 'USD' },
 * ]);
 * // → { amount: 36.50, currency: 'USD' }
 * ```
 */
export function sumMoney(items: Money[]): Money {
  if (items.length === 0) {
    throw new Error('sumMoney: se requiere al menos un valor monetario');
  }

  const currency = items[0]!.currency.toUpperCase();

  // Validar que todas las monedas coincidan.
  for (let i = 1; i < items.length; i++) {
    if (items[i]!.currency.toUpperCase() !== currency) {
      throw new Error(
        `sumMoney: no se pueden sumar monedas diferentes (${currency} vs ${items[i]!.currency.toUpperCase()})`,
      );
    }
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    amount: roundAmount(total, currency),
    currency,
  };
}

/**
 * Multiplica un valor monetario por un factor numérico.
 *
 * @param money - Valor monetario base.
 * @param factor - Factor multiplicador.
 * @returns Money con el resultado redondeado.
 *
 * @example
 * ```ts
 * multiplyMoney({ amount: 25.00, currency: 'USD' }, 3);
 * // → { amount: 75.00, currency: 'USD' }
 *
 * multiplyMoney({ amount: 10.00, currency: 'USD' }, 1.1);
 * // → { amount: 11.00, currency: 'USD' }
 * ```
 */
export function multiplyMoney(money: Money, factor: number): Money {
  const currency = money.currency.toUpperCase();
  return {
    amount: roundAmount(money.amount * factor, currency),
    currency,
  };
}

/**
 * Calcula el cambio porcentual entre dos valores monetarios.
 * Ambos valores deben estar en la misma moneda.
 *
 * @param current - Valor actual.
 * @param previous - Valor anterior (base de comparación).
 * @returns Porcentaje de cambio (positivo = incremento, negativo = decremento).
 *          Retorna 0 si el valor anterior es 0 y el actual también.
 *          Retorna Infinity si el anterior es 0 y el actual es positivo.
 *
 * @example
 * ```ts
 * percentChange(
 *   { amount: 150, currency: 'USD' },
 *   { amount: 100, currency: 'USD' }
 * );
 * // → 50 (50% de incremento)
 *
 * percentChange(
 *   { amount: 80, currency: 'USD' },
 *   { amount: 100, currency: 'USD' }
 * );
 * // → -20 (20% de decremento)
 * ```
 */
export function percentChange(current: Money, previous: Money): number {
  const currCurrency = current.currency.toUpperCase();
  const prevCurrency = previous.currency.toUpperCase();

  if (currCurrency !== prevCurrency) {
    throw new Error(
      `percentChange: no se pueden comparar monedas diferentes (${currCurrency} vs ${prevCurrency})`,
    );
  }

  if (previous.amount === 0) {
    if (current.amount === 0) return 0;
    return current.amount > 0 ? Infinity : -Infinity;
  }

  const change = ((current.amount - previous.amount) / Math.abs(previous.amount)) * 100;

  // Redondear a 2 decimales para porcentajes legibles.
  return Math.round(change * 100) / 100;
}
