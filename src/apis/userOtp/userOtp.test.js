const {
    createUserOtpDao,
    getUserOtpDao,
    updateUserOtpDao,
  } = require('./userOtpDao');
  const { tableName } = require('../../constants');
  const { buildInsertQuery, buildUpdateQuery, executeQuery } = require('../../utils/db');
  const { logger } = require('../../utils/logger');
  
  jest.mock('../../utils/db');
  jest.mock('../../utils/logger');
  
  describe('User OTP DAO', () => {
    beforeEach(() => {
      logger.error = jest.fn();
      buildInsertQuery.mockReturnValue(['INSERT INTO user_otp (user_id, otp) VALUES ($1, $2)', [1, '123456']]);
      buildUpdateQuery.mockReturnValue(['UPDATE user_otp SET is_used = $1 WHERE user_id = $2', [true, 1]]);
      executeQuery.mockResolvedValue({ rows: [{ id: 1, user_id: 1, otp: '123456', is_used: false }] });
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    describe('createUserOtpDao', () => {
      const payload = { user_id: 1, otp: '123456' };
      const mockResult = { id: 1, user_id: 1, otp: '123456', is_used: false };
  
      test('should create OTP with connection', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [mockResult] }) };
        const result = await createUserOtpDao(payload, mockConn);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.USER_OTP, payload);
        expect(mockConn.query).toHaveBeenCalledWith('INSERT INTO user_otp (user_id, otp) VALUES ($1, $2)', [1, '123456']);
        expect(result).toEqual(mockResult);
      });
  
      test('should create OTP without connection', async () => {
        const result = await createUserOtpDao(payload);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.USER_OTP, payload);
        expect(executeQuery).toHaveBeenCalledWith('INSERT INTO user_otp (user_id, otp) VALUES ($1, $2)', [1, '123456']);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle error during OTP creation', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(createUserOtpDao(payload)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error creating OTP for user_id: 1', error);
      });
    });
  
    describe('getUserOtpDao', () => {
      const otp = '123456';
      const mockResult = { id: 1, user_id: 1, otp: '123456', is_used: false, created_at: new Date() };
  
      test('should fetch OTP successfully', async () => {
        const otp = '123456';
        const mockResult = { id: 1, user_id: 1, otp: '123456', is_used: false, created_at: new Date() };
        executeQuery.mockResolvedValue({ rows: [mockResult] });
      
        const result = await getUserOtpDao(otp);
      
        // Use regex to match the query, ignoring extra whitespace
        const expectedQueryPattern = /SELECT\s+id,\s*user_id,\s*is_used,\s*otp,\s*expiration_time,\s*created_at,\s*updated_at\s+FROM\s+public\."UserOtp"\s+WHERE\s+otp\s*=\s*\$1\s+ORDER\s+BY\s+created_at\s+DESC\s+LIMIT\s+1/;
        
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(expectedQueryPattern),
          [otp]
        );
        expect(result).toEqual(mockResult);
      });
  
      test('should handle error during OTP fetch', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(getUserOtpDao(otp)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error in getUserOtpDao:', error);
      });
  
      test('should return undefined if no OTP found', async () => {
        executeQuery.mockResolvedValue({ rows: [] });
  
        const result = await getUserOtpDao(otp);
        expect(result).toBeUndefined();
      });
    });
  
    describe('updateUserOtpDao', () => {
      const user_id = 1;
      const data = { is_used: true };
      const mockResult = { id: 1, user_id: 1, otp: '123456', is_used: false };
  
      test('should update OTP with connection', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [mockResult] }) };
        const result = await updateUserOtpDao(user_id, data, mockConn);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.USER_OTP, data, user_id);
        expect(mockConn.query).toHaveBeenCalledWith('UPDATE user_otp SET is_used = $1 WHERE user_id = $2', [true, 1]);
        expect(result).toEqual(mockResult);
      });
  
      test('should update OTP without connection', async () => {
        const result = await updateUserOtpDao(user_id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.USER_OTP, data, user_id);
        expect(executeQuery).toHaveBeenCalledWith('UPDATE user_otp SET is_used = $1 WHERE user_id = $2', [true, 1]);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle error during OTP update', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(updateUserOtpDao(user_id, data)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error in updateUserOtpDao:', error);
      });
    });
  });