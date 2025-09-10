import { createServer } from 'http';
import Client from 'socket.io-client';
import { Server } from 'socket.io';
import {
  initializeSocket,
  forceLogoutUser,
  deactivateBank,
  notifyNewTableEntry,
  newTableEntry,
  logOutUser,
  notifyBankResponseAccessUpdate,
} from './sockets'; // replace with your actual file path
import config from '../config/config.js';
import { logger } from './logger.js';

// Mock logger to prevent actual console output during tests
jest.mock('./logger.js', () => ({
  logger: {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Socket Server', () => {
  let ioServer;
  let httpServer;
  let httpServerAddr;
  let clientSocket;

  beforeAll((done) => {
    httpServer = createServer();
    initializeSocket(httpServer);
    httpServer.listen(() => {
      httpServerAddr = httpServer.address();
      done();
    });
  });

  afterAll(() => {
    if (clientSocket && clientSocket.connected) clientSocket.disconnect();
    if (httpServer) httpServer.close();
  });

  test('should connect client and receive new-entry', (done) => {
    clientSocket = Client(`http://localhost:${httpServerAddr.port}`, {
      transports: ['websocket'],
    });

    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
    });

    clientSocket.on('new-entry', (data) => {
      expect(data).toHaveProperty('message', 'Hello from server!!!');
      done();
    });
  });

  test('forceLogoutUser should disconnect the socket', async () => {
    const mockSocket = {
      userId: 'user1',
      sessionId: 'sess1',
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    // Temporarily add mock socket to ioInstance
    const { ioInstance } = await import('./socketServer');
    ioInstance.fetchSockets = jest.fn().mockResolvedValue([mockSocket]);

    await forceLogoutUser('user1');

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'forceLogout',
      expect.objectContaining({ userId: 'user1' }),
    );
    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
  });

  test('deactivateBank emits correct event', async () => {
    const { ioInstance } = await import('./socketServer');
    ioInstance.emit = jest.fn();

    deactivateBank('HDFC', 'bank123', 'user1', false);

    expect(ioInstance.emit).toHaveBeenCalledWith('bankStatusUpdate', {
      message: 'The Bank HDFC is Deactivated',
      bankId: 'bank123',
      nickname: 'HDFC',
      userId: 'user1',
      isEnabled: false,
    });
  });

  test('notifyNewTableEntry emits correct event', async () => {
    const { ioInstance } = await import('./socketServer');
    ioInstance.emit = jest.fn();

    await notifyNewTableEntry('Users', 'INSERT', { name: 'John' });

    expect(ioInstance.emit).toHaveBeenCalledWith(
      'newTableEntryUsers',
      expect.objectContaining({
        tableName: 'Users',
        entryType: 'INSERT',
        entryData: { name: 'John' },
      }),
    );
  });

  test('newTableEntry emits correct event', async () => {
    const { ioInstance } = await import('./socketServer');
    ioInstance.emit = jest.fn();

    await newTableEntry('Orders', { orderId: '123' });

    expect(ioInstance.emit).toHaveBeenCalledWith('newTableEntryOrders', {
      orderId: '123',
    });
  });

  test('logOutUser emits correct event', async () => {
    const { ioInstance } = await import('./socketServer');
    ioInstance.emit = jest.fn();

    await logOutUser('user1');

    expect(ioInstance.emit).toHaveBeenCalledWith('newlogout', 'user1');
  });

  test('notifyBankResponseAccessUpdate emits correct events', async () => {
    const { ioInstance } = await import('./socketServer');
    ioInstance.emit = jest.fn();
    ioInstance.fetchSockets = jest.fn().mockResolvedValue([
      { userId: 'user1', emit: jest.fn() },
    ]);

    await notifyBankResponseAccessUpdate('user1', true, 'V123');

    expect(ioInstance.emit).toHaveBeenCalledWith(
      'bankResponseAccessUpdate',
      expect.objectContaining({ user_id: 'user1', bank_response_access: true }),
    );
  });
});
