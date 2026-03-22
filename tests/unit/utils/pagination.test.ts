import { describe, it, expect } from 'vitest';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface PaginationParams {
  page: number;
  limit: number;
}

function paginate<T>(items: T[], params: PaginationParams): PaginatedResponse<T> {
  const { page, limit } = params;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedItems = items.slice(start, end);
  return {
    items: paginatedItems,
    total: items.length,
    page,
    limit,
    hasMore: end < items.length,
  };
}

function buildPaginationInfo(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    hasMore: page < totalPages,
    totalPages,
    currentPage: page,
  };
}

describe('Pagination Utils', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

  describe('paginate', () => {
    it('debe paginar correctamente la primera página', () => {
      const result = paginate(items, { page: 1, limit: 10 });
      expect(result.items).toHaveLength(10);
      expect(result.items[0].id).toBe(1);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
    });

    it('debe paginar correctamente la última página', () => {
      const result = paginate(items, { page: 3, limit: 10 });
      expect(result.items).toHaveLength(5);
      expect(result.items[0].id).toBe(21);
      expect(result.hasMore).toBe(false);
    });

    it('debe retornar vacío si la página excede el total', () => {
      const result = paginate(items, { page: 10, limit: 10 });
      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('debe manejar limit mayor que total', () => {
      const result = paginate(items, { page: 1, limit: 100 });
      expect(result.items).toHaveLength(25);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('buildPaginationInfo', () => {
    it('debe calcular info de paginación correctamente', () => {
      const info = buildPaginationInfo(25, 1, 10);
      expect(info.totalPages).toBe(3);
      expect(info.hasMore).toBe(true);
      expect(info.currentPage).toBe(1);
    });

    it('debe detectar última página', () => {
      const info = buildPaginationInfo(25, 3, 10);
      expect(info.hasMore).toBe(false);
    });

    it('debe manejar total = 0', () => {
      const info = buildPaginationInfo(0, 1, 10);
      expect(info.totalPages).toBe(0);
      expect(info.hasMore).toBe(false);
    });
  });
});
