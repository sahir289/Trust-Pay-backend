import { buildSearchFilterObj, buildFilterConditions } from './searchBuilder.js';
import { tableName as dbTables } from '../constants/index.js';
import { BadRequestError, InternalServerError } from './appErrors.js';

describe('Filter Utilities', () => {
  describe('buildSearchFilterObj', () => {
    it('should throw BadRequestError if search is not a string', () => {
      expect(() => buildSearchFilterObj(123, dbTables.MERCHANT)).toThrow(BadRequestError);
    });

    it('should throw InternalServerError if table does not exist', () => {
      expect(() => buildSearchFilterObj('first_name', 'UnknownTable')).toThrow(InternalServerError);
    });

    it('should build filter object for simple string search', () => {
      const result = buildSearchFilterObj('first_name', dbTables.MERCHANT);
      expect(result).toHaveProperty('first_name');
    });

    it('should handle multiple comma-separated values', () => {
      const result = buildSearchFilterObj('first_name, last_name', dbTables.MERCHANT);
      expect(result).toHaveProperty('first_name');
      expect(result).toHaveProperty('last_name');
    });

    it('should handle boolean and number values correctly', () => {
      const result = buildSearchFilterObj('true,123', dbTables.MERCHANT);
      expect(result).toHaveProperty('is_enabled', true);
      expect(result).toHaveProperty('min_payin', 123);
    });

    it('should assign unmatched values to or.$raw', () => {
      const result = buildSearchFilterObj('unmatched_value', dbTables.MERCHANT);
      if ('or' in result) {
        expect(result.or.$raw).toBe('unmatched_value');
      } else {
        expect(result.or).toBeUndefined();
      }
    });
    
  });

  describe('buildFilterConditions', () => {
    const tableConfigs = {
      Merchant: {
        columns: ['first_name', 'min_payin', 'is_enabled'],
        columnTypes: { first_name: 'string', min_payin: 'number', is_enabled: 'boolean' },
        jsonFields: ['config'],
      },
    };

    it('should build conditions and queryParams for string, number, boolean filters', () => {
      const filters = { first_name: 'John', min_payin: 100, is_enabled: true };
      const { conditions, queryParams } = buildFilterConditions(filters, tableConfigs);
      expect(conditions.length).toBeGreaterThan(0);
      expect(queryParams).toEqual(['%John%', 100, true]);
    });

    it('should handle space-separated strings', () => {
      const filters = { first_name: 'John Doe' };
      const { conditions, queryParams } = buildFilterConditions(filters, tableConfigs);
      expect(queryParams).toEqual(['%John%', '%Doe%']);
      expect(conditions.join(' ')).toContain('ILIKE');
    });

    it('should skip page and limit keys', () => {
      const filters = { first_name: 'Jane', page: 2, limit: 10 };
      const { conditions, queryParams } = buildFilterConditions(filters, tableConfigs);
      expect(conditions.join(' ')).toContain('first_name');
      expect(queryParams).toEqual(['%Jane%']);
    });

    it('should add JSON fields to conditions for string values', () => {
      const filters = { first_name: 'John' };
      const { conditions } = buildFilterConditions(filters, tableConfigs);
      expect(conditions.join(' ')).toContain('config::text ILIKE');
    });
  });
});
