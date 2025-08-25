// const {
//     getSettlementDao,
//     getSettlementsBySearchDao,
//     getSettlementDaoforInternalTransfer,
//     createSettlementDao,
//     updateSettlementDao,
//     deleteSettlementDao,
//   } = require('./settlementDao'); // Adjust path to your DAO file
//   const { executeQuery, buildInsertQuery, buildUpdateQuery } = require('../../utils/db');
//   const { logger } = require('../../utils/logger');
//   const { Role, Status, tableName } = require('../../constants');
  
//   // Mock dependencies
//   jest.mock('../../utils/db');
//   jest.mock('../../utils/logger');
//   jest.mock('dayjs', () => {
//     const actualDayjs = jest.requireActual('dayjs');
//     actualDayjs.tz = jest.fn((date, timezone) => ({
//       utc: jest.fn(() => ({
//         format: jest.fn(() => date.includes('23:59:59') ? '2025-08-22T18:29:59.999Z' : '2025-08-22T00:00:00Z'),
//       })),
//     }));
//     return actualDayjs;
//   });
  
//   // Mock logger to avoid console output during tests
//   logger.error = jest.fn();
  
//   describe('Settlement DAO', () => {
//     const mockConn = { query: jest.fn() };
//     const mockSettlement = {
//       id: '1',
//       sno: 1,
//       user_id: 'user1',
//       company_id: '123',
//       amount: 1000,
//       status: Status.SUCCESS,
//       method: 'BANK',
//       config: { reference_id: 'UTR123' },
//     };
  
//     beforeEach(() => {
//       jest.clearAllMocks();
//     });
  
//     describe('getSettlementDao', () => {
//       it('should fetch settlements with basic filters', async () => {
//         const filters = { company_id: '123', status: Status.SUCCESS };
//         const mockRows = [mockSettlement];
//         executeQuery.mockResolvedValue({ rows: mockRows });
  
//         const result = await getSettlementDao(filters, 1, 10, 'sno', 'DESC', ['id', 'amount']);
  
//         expect(result).toEqual(mockRows);
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining('SELECT DISTINCT ON (s.sno) r.role, s.id, s.amount'),
//           expect.arrayContaining(['123', Status.SUCCESS])
//         );
//       });
  
//       it('should handle user_id as array', async () => {
//         const filters = { company_id: '123', user_id: ['user1', 'user2'] };
//         executeQuery.mockResolvedValue({ rows: [mockSettlement] });
  
//         await getSettlementDao(filters, 1, 10);
  
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining('s.user_id IN ($2, $3)'),
//           expect.arrayContaining(['123', 'user1', 'user2'])
//         );
//       });
  
//       it('should handle date range for SUCCESS status', async () => {
//         const filters = { company_id: '123', status: Status.SUCCESS, start_date: '2025-08-22', end_date: '2025-08-22' };
//         executeQuery.mockResolvedValue({ rows: [mockSettlement] });
  
//         await getSettlementDao(filters, 1, 10);
  
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining('s.approved_at BETWEEN $2 AND $3'),
//           expect.arrayContaining(['123', '2025-08-22T00:00:00Z', '2025-08-22T18:29:59.999Z'])
//         );
//       });
  
//       it('should handle pagination', async () => {
//         const filters = { company_id: '123' };
//         executeQuery.mockResolvedValue({ rows: [mockSettlement] });
  
//         await getSettlementDao(filters, 2, 10);
  
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining('LIMIT $2 OFFSET $3'),
//           expect.arrayContaining(['123', 10, 10])
//         );
//       });
  
//       it('should handle errors', async () => {
//         executeQuery.mockRejectedValue(new Error('DB error'));
  
//         await expect(getSettlementDao({ company_id: '123' })).rejects.toThrow('DB error');
//         expect(logger.error).toHaveBeenCalledWith('Error in getSettlementDao:', expect.any(Error));
//       });
//     });
  
//     describe('getSettlementsBySearchDao', () => {
//       it('should fetch settlements with search terms for ADMIN', async () => {
//         const filters = { company_id: '123' };
//         const searchTerms = ['term1'];
//         executeQuery
//           .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // Count query
//           .mockResolvedValueOnce({ rows: [mockSettlement] }); // Data query
  
//         const result = await getSettlementsBySearchDao(filters, 1, 10, 'sno', 'DESC', [], searchTerms, Role.ADMIN);
  
//         expect(result).toEqual({
//           totalCount: 5,
//           totalPages: 1,
//           settlements: [mockSettlement],
//         });
//         expect(executeQuery).toHaveBeenCalledTimes(2);
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining('LOWER(s.id::text) LIKE LOWER($2)'),
//           expect.arrayContaining(['123', '%term1%'])
//         );
//       });
  
//       it('should handle boolean search terms', async () => {
//         const filters = { company_id: '123' };
//         const searchTerms = ['true'];
//         executeQuery
//           .mockResolvedValueOnce({ rows: [{ total: '5' }] })
//           .mockResolvedValueOnce({ rows: [mockSettlement] });
  
//         await getSettlementsBySearchDao(filters, 1, 10, 'sno', 'DESC', [], searchTerms, Role.ADMIN);
  
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining('s.is_notified = $2'),
//           expect.arrayContaining(['123', true])
//         );
//       });
  
//       it('should reset offset for empty results on later pages', async () => {
//         const filters = { company_id: '123' };
//         executeQuery
//           .mockResolvedValueOnce({ rows: [{ total: '5' }] })
//           .mockResolvedValueOnce({ rows: [] })
//           .mockResolvedValueOnce({ rows: [mockSettlement] });
  
//         const result = await getSettlementsBySearchDao(filters, 2, 10);
  
//         expect(result.settlements).toEqual([mockSettlement]);
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining('OFFSET $2'),
//           expect.arrayContaining(['123', 0])
//         );
//       });
  
//       it('should handle invalid sort column', async () => {
//         const filters = { company_id: '123' };
//         executeQuery
//           .mockResolvedValueOnce({ rows: [{ total: '5' }] })
//           .mockResolvedValueOnce({ rows: [mockSettlement] });
  
//         await getSettlementsBySearchDao(filters, 1, 10, 'invalid_column', 'ASC');
  
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining('ORDER BY sno ASC'),
//           expect.any(Array)
//         );
//       });
  
//       it('should handle errors', async () => {
//         executeQuery.mockRejectedValue(new Error('DB error'));
  
//         await expect(getSettlementsBySearchDao({ company_id: '123' })).rejects.toThrow('DB error');
//         expect(logger.error).toHaveBeenCalledWith('Error in getSettlementsBySearchDao:', expect.any(Error));
//       });
//     });
  
//     describe('getSettlementDaoforInternalTransfer', () => {
//       it('should fetch settlement by UTR and method', async () => {
//         const mockRows = [mockSettlement];
//         executeQuery.mockResolvedValue({ rows: mockRows });
  
//         const result = await getSettlementDaoforInternalTransfer('UTR123', ['INTERNAL_QR_TRANSFER']);
  
//         expect(result).toEqual(mockRows);
//         expect(executeQuery).toHaveBeenCalledWith(
//           expect.stringContaining("config->>'reference_id' = $1 AND method = ANY($2)"),
//           ['UTR123', ['INTERNAL_QR_TRANSFER']]
//         );
//       });
  
//       it('should return empty array for no results', async () => {
//         executeQuery.mockResolvedValue({ rows: [] });
  
//         const result = await getSettlementDaoforInternalTransfer('UTR123', ['INTERNAL_QR_TRANSFER']);
  
//         expect(result).toEqual([]);
//       });
  
//       it('should handle errors', async () => {
//         executeQuery.mockRejectedValue(new Error('DB error'));
  
//         await expect(getSettlementDaoforInternalTransfer('UTR123', ['INTERNAL_QR_TRANSFER']))
//           .rejects.toThrow('DB error');
//         expect(logger.error).toHaveBeenCalled();
//       });
//     });
  
//     describe('createSettlementDao', () => {
//       it('should create settlement with connection', async () => {
//         const payload = { company_id: '123', amount: 1000, user_id: 'user1' };
//         buildInsertQuery.mockReturnValue(['INSERT INTO "Settlement" ...', ['123', 1000, 'user1']]);
//         mockConn.query.mockResolvedValue({ rows: [mockSettlement] });
  
//         const result = await createSettlementDao(payload, mockConn);
  
//         expect(result).toEqual(mockSettlement);
//         expect(buildInsertQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, payload);
//         expect(mockConn.query).toHaveBeenCalled();
//       });
  
//       it('should create settlement without connection', async () => {
//         const payload = { company_id: '123', amount: 1000, user_id: 'user1' };
//         buildInsertQuery.mockReturnValue(['INSERT INTO "Settlement" ...', ['123', 1000, 'user1']]);
//         executeQuery.mockResolvedValue({ rows: [mockSettlement] });
  
//         const result = await createSettlementDao(payload);
  
//         expect(result).toEqual(mockSettlement);
//         expect(executeQuery).toHaveBeenCalled();
//       });
  
//       it('should handle errors', async () => {
//         buildInsertQuery.mockReturnValue(['INSERT INTO "Settlement" ...', ['123']]);
//         executeQuery.mockRejectedValue(new Error('DB error'));
  
//         await expect(createSettlementDao({ company_id: '123' })).rejects.toThrow('DB error');
//         expect(logger.error).toHaveBeenCalled();
//       });
//     });
  
//     describe('updateSettlementDao', () => {
//       it('should update settlement with connection', async () => {
//         const id = { id: '1', company_id: '123' };
//         const data = { amount: 2000 };
//         buildUpdateQuery.mockReturnValue(['UPDATE "Settlement" ...', [2000, '1', '123']]);
//         mockConn.query.mockResolvedValue({ rows: [mockSettlement] });
  
//         const result = await updateSettlementDao(mockConn, id, data);
  
//         expect(result).toEqual(mockSettlement);
//         expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, data, id);
//         expect(mockConn.query).toHaveBeenCalled();
//       });
  
//       it('should update settlement without connection', async () => {
//         const id = { id: '1', company_id: '123' };
//         const data = { amount: 2000 };
//         buildUpdateQuery.mockReturnValue(['UPDATE "Settlement" ...', [2000, '1', '123']]);
//         executeQuery.mockResolvedValue({ rows: [mockSettlement] });
  
//         const result = await updateSettlementDao(null, id, data);
  
//         expect(result).toEqual(mockSettlement);
//         expect(executeQuery).toHaveBeenCalled();
//       });
  
//       it('should handle errors', async () => {
//         buildUpdateQuery.mockReturnValue(['UPDATE "Settlement" ...', ['123']]);
//         executeQuery.mockRejectedValue(new Error('DB error'));
  
//         await expect(updateSettlementDao(null, { id: '1', company_id: '123' }, { amount: 2000 }))
//           .rejects.toThrow('DB error');
//         expect(logger.error).toHaveBeenCalled();
//       });
//     });
  
//     describe('deleteSettlementDao', () => {
//       it('should delete settlement with connection', async () => {
//         const id = { id: '1', company_id: '123' };
//         const data = { is_obsolete: true, updated_by: 'user1' };
//         buildUpdateQuery.mockReturnValue(['UPDATE "Settlement" ...', [true, 'user1', '1', '123']]);
//         mockConn.query.mockResolvedValue({ rows: [mockSettlement] });
  
//         const result = await deleteSettlementDao(mockConn, id, data);
  
//         expect(result).toEqual(mockSettlement);
//         expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, data, id);
//         expect(mockConn.query).toHaveBeenCalled();
//       });
  
//       it('should delete settlement without connection', async () => {
//         const id = { id: '1', company_id: '123' };
//         const data = { is_obsolete: true, updated_by: 'user1' };
//         buildUpdateQuery.mockReturnValue(['UPDATE "Settlement" ...', [true, 'user1', '1', '123']]);
//         executeQuery.mockResolvedValue({ rows: [mockSettlement] });
  
//         const result = await deleteSettlementDao(null, id, data);
  
//         expect(result).toEqual(mockSettlement);
//         expect(executeQuery).toHaveBeenCalled();
//       });
  
//       it('should handle errors', async () => {
//         buildUpdateQuery.mockReturnValue(['UPDATE "Settlement" ...', ['123']]);
//         executeQuery.mockRejectedValue(new Error('DB error'));
  
//         await expect(deleteSettlementDao(null, { id: '1', company_id: '123' }, { is_obsolete: true }))
//           .rejects.toThrow('DB error');
//         expect(logger.error).toHaveBeenCalled();
//       });
//     });
//   });