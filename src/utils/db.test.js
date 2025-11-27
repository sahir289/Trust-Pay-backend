'use strict';

// import mysql from 'mysql2/promise';
import { jest } from '@jest/globals';

// --- MOCK LOGGER (FIXES YOUR ERROR) ---
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---- IMPORT MODULE AFTER MOCKS ----
import {
  executeQuery,
  buildUpdateQuery,
  buildAndExecuteUpdateQuery,
  retrySerialization,
  startTransaction,
  commitTransaction,
  rollbackTransaction,
  getConnection,
  getSimpleConnection
} from '../utils/db.js';

// ---- MOCK MYSQL ----
// jest.mock('mysql2/promise');

describe('DB Utility Test Suite', () => {
  let mockConn;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConn = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      execute: jest.fn(),
      end: jest.fn(),
    };

    mysql.createConnection.mockResolvedValue(mockConn);
  });

  // -----------------------------
  // executeQuery()
  // -----------------------------
  test('executeQuery should run query using passed connection', async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1 }], []]);

    const result = await executeQuery(mockConn, 'SELECT 1', []);

    expect(result).toEqual([{ id: 1 }]);
    expect(mockConn.execute).toHaveBeenCalledWith('SELECT 1', []);
  });

  // -----------------------------
  // buildUpdateQuery()
  // -----------------------------
  test('buildUpdateQuery should build update SQL and values', () => {
    const payload = { status: 'done', message: 'ok' };

    const { query, values } = buildUpdateQuery('task', payload, 'id', 10);

    expect(query).toBe('UPDATE task SET status = ?, message = ? WHERE id = ?');
    expect(values).toEqual(['done', 'ok', 10]);
  });

  // -----------------------------
  // buildAndExecuteUpdateQuery()
  // -----------------------------
  test('buildAndExecuteUpdateQuery executes correct SQL', async () => {
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await buildAndExecuteUpdateQuery(
      mockConn,
      'task',
      { status: 'done' },
      'id',
      10
    );

    expect(result.affectedRows).toBe(1);
    expect(mockConn.execute).toHaveBeenCalled();
  });

  // -----------------------------
  // retrySerialization()
  // -----------------------------
  test('retrySerialization retries on serialization error', async () => {
    let attempt = 0;
    const fn = jest.fn(async () => {
      attempt++;
      if (attempt < 2) {
        const err = new Error('ER_LOCK_DEADLOCK');
        err.code = '40001';
        throw err;
      }
      return 'SUCCESS';
    });

    const result = await retrySerialization(fn, 3);

    expect(result).toBe('SUCCESS');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // -----------------------------
  // startTransaction()
  // -----------------------------
  test('startTransaction should start MySQL transaction', async () => {
    const conn = await startTransaction();

    expect(mysql.createConnection).toHaveBeenCalled();
    expect(conn.beginTransaction).toHaveBeenCalled();
  });

  // -----------------------------
  // commitTransaction()
  // -----------------------------
  test('commitTransaction should commit and close connection', async () => {
    await commitTransaction(mockConn);

    expect(mockConn.commit).toHaveBeenCalled();
    expect(mockConn.end).toHaveBeenCalled();
  });

  // -----------------------------
  // rollbackTransaction()
  // -----------------------------
  test('rollbackTransaction should rollback and close connection', async () => {
    await rollbackTransaction(mockConn);

    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.end).toHaveBeenCalled();
  });

  // -----------------------------
  // getConnection()
  // -----------------------------
  test('getConnection should return new MySQL connection', async () => {
    const conn = await getConnection();

    expect(mysql.createConnection).toHaveBeenCalled();
    expect(conn).toBe(mockConn);
  });

  // -----------------------------
  // getSimpleConnection()
  // -----------------------------
  test('getSimpleConnection should return new MySQL connection', async () => {
    const conn = await getSimpleConnection();

    expect(mysql.createConnection).toHaveBeenCalled();
    expect(conn).toBe(mockConn);
  });
});
