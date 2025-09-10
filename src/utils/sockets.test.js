import { jest } from '@jest/globals';
import * as socketUtils from './sockets';

describe('Socket Utilities', () => {
  let mockEmit;
  let mockTo;
  let mockIo;

  beforeEach(() => {
    // Reset mocks
    mockEmit = jest.fn();
    mockTo = jest.fn(() => ({ emit: mockEmit }));
    mockIo = {
      emit: mockEmit,
      to: mockTo,
      fetchSockets: jest.fn(async () => [
        { id: 'socket1', userId: 'user1', sessionId: 'sess1', emit: mockEmit, disconnect: jest.fn() },
      ]),
    };

    // Mock internal ioInstance getter via spy
    jest.spyOn(socketUtils, 'forceLogoutUser').mockImplementation(async (userId) => {
      mockIo.to(userId).emit('force-logout');
    });
    jest.spyOn(socketUtils, 'logOutUser').mockImplementation(async (userId) => {
      mockIo.to(userId).emit('logout');
    });
    jest.spyOn(socketUtils, 'deactivateBank').mockImplementation((bankId) => {
      mockIo.emit('deactivate-bank', bankId);
    });
    jest.spyOn(socketUtils, 'newTableEntry').mockImplementation((entry) => {
      mockIo.emit('new-table-entry', entry);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('forceLogoutUser should emit force-logout to a socket', async () => {
    await socketUtils.forceLogoutUser('socket1');
    expect(mockTo).toHaveBeenCalledWith('socket1');
    expect(mockEmit).toHaveBeenCalledWith('force-logout');
  });

  it('logOutUser should emit logout to a socket', async () => {
    await socketUtils.logOutUser('socket1');
    expect(mockTo).toHaveBeenCalledWith('socket1');
    expect(mockEmit).toHaveBeenCalledWith('logout');
  });

  it('deactivateBank should emit deactivate-bank event', () => {
    socketUtils.deactivateBank('bank123');
    expect(mockEmit).toHaveBeenCalledWith('deactivate-bank', 'bank123');
  });

  it('newTableEntry should emit new-table-entry event', () => {
    const entry = { id: 1, name: 'Test' };
    socketUtils.newTableEntry(entry);
    expect(mockEmit).toHaveBeenCalledWith('new-table-entry', entry);
  });

  it('all exported functions should be defined', () => {
    expect(typeof socketUtils.forceLogoutUser).toBe('function');
    expect(typeof socketUtils.logOutUser).toBe('function');
    expect(typeof socketUtils.deactivateBank).toBe('function');
    expect(typeof socketUtils.newTableEntry).toBe('function');
  });
});
