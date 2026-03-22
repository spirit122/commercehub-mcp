import { describe, it, expect } from 'vitest';

/** Tipos inline para tests independientes */
interface Money {
  amount: number;
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', MXN: '$', ARS: '$', BRL: 'R$',
  CLP: '$', COP: '$', PEN: 'S/', JPY: '¥', CNY: '¥',
};

function formatMoney(money: Money): string {
  const symbol = CURRENCY_SYMBOLS[money.currency] ?? '';
  const formatted = money.amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted} ${money.currency}`;
}

function parseMoney(amount: number, currency = 'USD'): Money {
  return { amount: Math.round(amount * 100) / 100, currency };
}

function sumMoney(items: Money[]): Money {
  if (items.length === 0) return { amount: 0, currency: 'USD' };
  const currency = items[0].currency;
  for (const item of items) {
    if (item.currency !== currency) {
      throw new Error(`No se pueden sumar monedas diferentes: ${currency} y ${item.currency}`);
    }
  }
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return { amount: Math.round(total * 100) / 100, currency };
}

function multiplyMoney(money: Money, factor: number): Money {
  return { amount: Math.round(money.amount * factor * 100) / 100, currency: money.currency };
}

function percentChange(current: Money, previous: Money): number {
  if (previous.amount === 0) return current.amount > 0 ? 100 : 0;
  return Math.round(((current.amount - previous.amount) / previous.amount) * 10000) / 100;
}

describe('Currency Utils', () => {
  describe('formatMoney', () => {
    it('debe formatear USD correctamente', () => {
      expect(formatMoney({ amount: 1234.56, currency: 'USD' })).toBe('$1,234.56 USD');
    });

    it('debe formatear MXN correctamente', () => {
      expect(formatMoney({ amount: 99.9, currency: 'MXN' })).toBe('$99.90 MXN');
    });

    it('debe formatear EUR correctamente', () => {
      expect(formatMoney({ amount: 50, currency: 'EUR' })).toBe('€50.00 EUR');
    });

    it('debe manejar monedas sin símbolo', () => {
      expect(formatMoney({ amount: 100, currency: 'XYZ' })).toBe('100.00 XYZ');
    });
  });

  describe('parseMoney', () => {
    it('debe crear Money con redondeo a 2 decimales', () => {
      expect(parseMoney(10.999)).toEqual({ amount: 11, currency: 'USD' });
    });

    it('debe usar USD como moneda default', () => {
      expect(parseMoney(50).currency).toBe('USD');
    });

    it('debe aceptar moneda personalizada', () => {
      expect(parseMoney(100, 'MXN')).toEqual({ amount: 100, currency: 'MXN' });
    });
  });

  describe('sumMoney', () => {
    it('debe sumar correctamente', () => {
      const result = sumMoney([
        { amount: 10.5, currency: 'USD' },
        { amount: 20.3, currency: 'USD' },
        { amount: 5.2, currency: 'USD' },
      ]);
      expect(result.amount).toBe(36);
      expect(result.currency).toBe('USD');
    });

    it('debe retornar 0 para array vacío', () => {
      expect(sumMoney([]).amount).toBe(0);
    });

    it('debe lanzar error si las monedas son diferentes', () => {
      expect(() =>
        sumMoney([
          { amount: 10, currency: 'USD' },
          { amount: 20, currency: 'EUR' },
        ]),
      ).toThrow('No se pueden sumar monedas diferentes');
    });
  });

  describe('multiplyMoney', () => {
    it('debe multiplicar correctamente', () => {
      const result = multiplyMoney({ amount: 100, currency: 'USD' }, 1.1);
      expect(result.amount).toBe(110);
    });

    it('debe redondear a 2 decimales', () => {
      const result = multiplyMoney({ amount: 33.33, currency: 'USD' }, 3);
      expect(result.amount).toBe(99.99);
    });
  });

  describe('percentChange', () => {
    it('debe calcular cambio porcentual positivo', () => {
      const result = percentChange(
        { amount: 120, currency: 'USD' },
        { amount: 100, currency: 'USD' },
      );
      expect(result).toBe(20);
    });

    it('debe calcular cambio porcentual negativo', () => {
      const result = percentChange(
        { amount: 80, currency: 'USD' },
        { amount: 100, currency: 'USD' },
      );
      expect(result).toBe(-20);
    });

    it('debe manejar previous = 0', () => {
      const result = percentChange(
        { amount: 100, currency: 'USD' },
        { amount: 0, currency: 'USD' },
      );
      expect(result).toBe(100);
    });
  });
});
