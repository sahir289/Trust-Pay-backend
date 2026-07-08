/* global describe, it, expect, beforeEach, beforeAll */
import { jest } from '@jest/globals';
import { Role, Status } from '../../src/constants/index.js';

let daos;

beforeAll(async () => {
  daos = await import('../../src/apis/reports/reportsDao.js');
});

const createMockConn = (rows = []) => ({
  query: jest.fn().mockResolvedValue({ rows }),
});

const getLastQuery = (conn) => conn.query.mock.calls[0]?.[0] || '';

describe('reportsDao', () => {
  describe('getPayInMerchantReportDao', () => {
    it('should fetch pay-in merchant report with basic filters', async () => {
      const mockRows = [{ id: 1, amount: 5000, status: Status.SUCCESS }];
      const conn = createMockConn(mockRows);

      const result = await daos.getPayInMerchantReportDao(
        [101],
        '2025-01-01',
        '2025-01-31',
        1,
        Role.MERCHANT,
        Status.SUCCESS,
        'false',
        conn,
      );

      expect(result).toEqual(mockRows);
      expect(conn.query).toHaveBeenCalled();
      const query = getLastQuery(conn);
      expect(query).toContain('FROM public."Payin"');
      expect(query).toContain('merchant_id = ANY');
    });

    it('should handle ADMIN role with vendor commission', async () => {
      const mockRows = [{ id: 2 }];
      const conn = createMockConn(mockRows);

      const result = await daos.getPayInMerchantReportDao(
        null,
        '2025-01-01',
        '2025-01-31',
        1,
        Role.ADMIN,
        null,
        'true',
        conn,
      );

      expect(result).toEqual(mockRows);
      const query = getLastQuery(conn);
      expect(query).toContain('vendor_code');
      expect(query).toContain('payin_vendor_commission');
    });

    it('should handle status as comma-separated string', async () => {
      const conn = createMockConn([]);

      await daos.getPayInMerchantReportDao(
        null,
        '2025-01-01',
        '2025-01-31',
        1,
        Role.MERCHANT,
        'SUCCESS,PENDING',
        'false',
        conn,
      );

      expect(conn.query).toHaveBeenCalled();
    });
  });

  describe('getPayInVendorReportDao', () => {
    it('should fetch pay-in vendor report', async () => {
      const mockRows = [{ id: 1, vendor_code: 'V001' }];
      const conn = createMockConn(mockRows);

      const result = await daos.getPayInVendorReportDao(
        [201],
        '2025-01-01',
        '2025-01-31',
        1,
        Role.VENDOR,
        [Status.SUCCESS],
        'false',
        conn,
      );

      expect(result).toEqual(mockRows);
      const query = getLastQuery(conn);
      expect(query).toContain('FROM public."Payin"');
      expect(query).toContain('bank_acc_id = ANY');
    });
  });

  describe('getPayOutMerchantReportDao', () => {
    it('should fetch payout merchant report', async () => {
      const conn = createMockConn([{ id: 100 }]);

      await daos.getPayOutMerchantReportDao(
        [101],
        '2025-01-01',
        '2025-01-31',
        1,
        Role.MERCHANT,
        Status.APPROVED,
        conn,
      );

      expect(conn.query).toHaveBeenCalled();
    });

    it('should include reversed status conditions', async () => {
      const conn = createMockConn([]);

      await daos.getPayOutMerchantReportDao(
        null,
        '2025-01-01',
        '2025-01-31',
        1,
        Role.ADMIN,
        [Status.REVERSED],
        conn,
      );

      const query = getLastQuery(conn);
      expect(query).toContain('to_timestamp');
      expect(query).toContain('reversed_at');
    });
  });

  describe('getPayOutVendorReportDao', () => {
    it('should fetch payout vendor report for ADMIN', async () => {
      const conn = createMockConn([]);

      await daos.getPayOutVendorReportDao(
        [301],
        '2025-01-01',
        '2025-01-31',
        1,
        Role.ADMIN,
        Status.APPROVED,
        conn,
      );

      const query = getLastQuery(conn);
      expect(query).toContain('payout_vendor_commission');
      expect(query).toContain('vendor_code');
    });

    it('should handle MERCHANT role', async () => {
      const conn = createMockConn([]);

      await daos.getPayOutVendorReportDao(
        null,
        '2025-01-01',
        '2025-01-31',
        1,
        Role.MERCHANT,
        null,
        conn,
      );

      expect(conn.query).toHaveBeenCalled();
    });
  });

  describe('getMerchantReportDao', () => {
    it('should throw BadRequestError if dates are missing', async () => {
      await expect(
        daos.getMerchantReportDao(1, [], null, null, 1, 10, Role.MERCHANT),
      ).rejects.toThrow('Both startDate and endDate must be provided');
    });

    it('should fetch merchant report successfully', async () => {
      const mockRows = [{ code: 'M001', total_payin_amount: 10000 }];
      const conn = createMockConn(mockRows);

      const result = await daos.getMerchantReportDao(
        1,
        [],
        '2025-01-01',
        '2025-01-31',
        1,
        10,
        Role.MERCHANT,
        conn,
      );

      expect(result).toEqual(mockRows);
      const query = getLastQuery(conn);
      expect(query).toContain('filtered_merchants');
      expect(query).toContain('"Calculation"');
    });

    it('should filter by specific userIds', async () => {
      const conn = createMockConn([]);

      await daos.getMerchantReportDao(
        1,
        [101, 102],
        '2025-01-01',
        '2025-01-31',
        null,
        null,
        Role.ADMIN,
        conn,
      );

      const query = getLastQuery(conn);
      expect(query).toContain('user_id = ANY');
    });

    it('should apply pagination when page and limit are provided', async () => {
      const conn = createMockConn([]);

      await daos.getMerchantReportDao(
        1,
        [],
        '2025-01-01',
        '2025-01-31',
        2,
        20,
        Role.MERCHANT,
        conn,
      );

      const query = getLastQuery(conn);
      expect(query).toContain('LIMIT');
      expect(query).toContain('OFFSET');
    });
  });

  describe('getVendorReportDao', () => {
    it('should fetch vendor report successfully', async () => {
      const mockRows = [{ code: 'V001' }];
      const conn = createMockConn(mockRows);

      const result = await daos.getVendorReportDao(
        1,
        [],
        '2025-01-01',
        '2025-01-31',
        1,
        20,
        Role.VENDOR,
        conn,
      );

      expect(result).toEqual(mockRows);
      const query = getLastQuery(conn);
      expect(query).toContain('filtered_vendors');
    });
  });

  describe('getPayinReportDao', () => {
    it('should use buildSelectQuery for generic payin report', async () => {
      const mockRows = [{ id: 1 }];
      const conn = createMockConn(mockRows);

      const result = await daos.getPayinReportDao(
        { status: Status.SUCCESS },
        1,
        10,
        'created_at',
        'DESC',
        conn,
      );

      expect(conn.query).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });
  });

  describe('getPayOutAll', () => {
    it('should fetch all payouts with minimal fields', async () => {
      const mockRows = [{ merchant_order_id: 'ORD123' }];
      const conn = createMockConn(mockRows);

      const result = await daos.getPayOutAll(
        { status: 'APPROVED' },
        1,
        50,
        undefined,
        undefined,
        conn,
      );

      expect(conn.query).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });
  });

  describe('Error Handling', () => {
    it('should log error and re-throw when query fails', async () => {
      const conn = {
        query: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      await expect(
        daos.getPayInMerchantReportDao(
          null,
          '2025-01-01',
          '2025-01-31',
          1,
          Role.MERCHANT,
          null,
          null,
          conn,
        ),
      ).rejects.toThrow('Database error');
    });
  });
});
