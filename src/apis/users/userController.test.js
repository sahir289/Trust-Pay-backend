import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/responseHandlers.js", () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule("./userService.js", () => ({
  getUsersService: jest.fn(),
  getUsersNameService: jest.fn(),
  getUsersBySearchService: jest.fn(),
  getUsersInfoBySearchService: jest.fn(),
  getUserByIdService: jest.fn(),
  getUsersByUserNameService: jest.fn(),
  createUserService: jest.fn(),
  userUpdateService: jest.fn(),
  sendMailService: jest.fn(),
  updateUser2FAService: jest.fn(),
  toggleUser2FAExemptionService: jest.fn(),
  resetUser2FAService: jest.fn(),
}));

jest.unstable_mockModule("./userDao.js", () => ({
  getUsersContactDao: jest.fn(),
}));

jest.unstable_mockModule("../../schemas/userSchema.js", () => ({
  CREATE_USER_SCHEMA: {
    validate: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/appErrors.js", () => ({
  BadRequestError: class BadRequestError extends Error {},
  ValidationError: class ValidationError extends Error {},
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/redishashkey.js", () => ({
  generateCacheKey: jest.fn(() => "cache-key"),
}));

jest.unstable_mockModule("../../utils/controllerCache.js", () => ({
  normalizeQueryForCache: jest.fn((q) => q),
  readJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(),
  writeJsonCache: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));

jest.unstable_mockModule("../../config/config.js", () => ({
  default: {
    controllerCacheTtls: {
      users: {
        list: 60,
        search: 60,
        byId: 60,
        byUsername: 60,
      },
    },
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  Role: {
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    MERCHANT: "MERCHANT",
  },
}));

const responseHandlers = await import(
  "../../utils/responseHandlers.js"
);

const userService = await import("./userService.js");

const cache = await import(
  "../../utils/controllerCache.js"
);

const redis = await import(
  "../../utils/redishashkey.js"
);

const loggerModule = await import(
  "../../utils/logger.js"
);

const userDao = await import("./userDao.js");

const schema = await import(
  "../../schemas/userSchema.js"
);

const { Role } = await import(
  "../../constants/index.js"
);

const {
  getUsers,
  getUsersnames,
  getUsersBySearch,
  getUsersInfoBySearch,
  getUsersByUserName,
  getUserById,
  createUser,
  updateUser,
  sendMail,
  toggleUser2FA,
  toggleUser2FAExemption,
  resetUser2FA,
} = await import("./userController.js");

const mockRes = {};

const mockUser = {
  company_id: 10,
  user_id: 1,
  user_name: "admin",
  role: Role.ADMIN,
  designation: Role.ADMIN,
  role_id: 1,
  designation_id: 1,
};

beforeEach(() => {
  jest.clearAllMocks();

  cache.readJsonCache.mockResolvedValue(null);
  cache.shouldServeCachedResponse.mockReturnValue(false);
  cache.writeJsonCache.mockResolvedValue();
  cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

  responseHandlers.sendSuccess.mockImplementation(
    (res, data, message) => ({
      res,
      data,
      message,
    })
  );
});
describe('getUsersController - getUsers', () => {
  const mockReq = (query = {}, user = {}) => ({
    query,
    user,
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated users successfully', async () => {
    const req = mockReq(
      { page: 1, limit: 10 },
      { role: 'ADMIN', userId: 1 }
    );
    const res = mockRes();

    const mockData = {
      data: [{ id: 1, name: 'User1' }],
      total: 1,
      page: 1,
      limit: 10,
    };

    userService.getUsersService.mockResolvedValue(mockData);

    expect(userService.getUsersService).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        user: req.user,
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockData.data,
      })
    );
  });

  it('should apply default pagination when query is missing', async () => {
    const req = mockReq({}, { role: 'ADMIN', userId: 1 });
    const res = mockRes();

    const mockData = {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    };

    userService.getUsersService.mockResolvedValue(mockData);

    await getUsers(req, res);

    expect(userService.getUsersService).toHaveBeenCalledWith(
        expect.objectContaining({
            company_id: req.user.company_id,
        }),
        req.user.role,
        undefined,
        undefined,
        req.user.designation,
        req.user.user_id,
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle merchant role filtering', async () => {
    const req = mockReq(
      { page: 1, limit: 10 },
      { role: 'MERCHANT', userId: 10 }
    );
    const res = mockRes();

    userService.getUsersService.mockResolvedValue({
      data: [{ id: 2, name: 'MerchantUser' }],
      total: 1,
    });

    expect(userService.getUsersService).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ role: 'MERCHANT' }),
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle vendor role filtering', async () => {
    const req = mockReq(
      { page: 2, limit: 5 },
      { role: 'VENDOR', userId: 20 }
    );
    const res = mockRes();

    userService.getUsersService.mockResolvedValue({
      data: [{ id: 3, name: 'VendorUser' }],
      total: 1,
    });

    expect(userService.getUsersService).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });

  it('should handle sub-vendor role filtering', async () => {
    const req = mockReq(
      { page: 1, limit: 10 },
      { role: 'SUB_VENDOR', userId: 30 }
    );
    const res = mockRes();

    userService.getUsersService.mockResolvedValue({
      data: [],
      total: 0,
    });


    expect(userService.getUsersService).toHaveBeenCalledWith(
        expect.any(Object),
        "SUB_VENDOR",
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
    );
  });

  it('should handle service throwing error', async () => {
    const req = mockReq({ page: 1, limit: 10 }, { role: 'ADMIN' });
    const res = mockRes();

    userService.getUsersService.mockRejectedValue(new Error('DB error'));

  });

  it('should ensure numeric conversion of pagination params', async () => {
    const req = mockReq(
      { page: '3', limit: '15' },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    userService.getUsersService.mockResolvedValue({
      data: [],
      total: 0,
    });


    expect(userService.getUsersService).toHaveBeenCalledWith(
      expect.objectContaining({
        page: expect.any(Number),
        limit: expect.any(Number),
      })
    );
  });

  it('should return correct response structure', async () => {
    const req = mockReq({ page: 1, limit: 10 }, { role: 'ADMIN' });
    const res = mockRes();

    userService.getUsersService.mockResolvedValue({
      data: [{ id: 1 }],
      total: 1,
      page: 1,
      limit: 10,
    });


    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
      })
    );
  });
});
describe('getUsersController - names & search', () => {
  const mockReq = (query = {}, user = {}) => ({
    query,
    user,
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all user names successfully (getUsersNames)', async () => {
    const req = mockReq({}, { role: 'ADMIN', userId: 1 });
    const res = mockRes();

    const mockData = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    userService.getUsersService.mockResolvedValue(mockData);

    await getUsersNamesController(req, res);

    expect(userService.getUsersService).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'NAMES',
        user: req.user,
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockData,
      })
    );
  });

  it('should return empty list when no users exist (getUsersNames)', async () => {
    const req = mockReq({}, { role: 'ADMIN' });
    const res = mockRes();

    userService.getUsersService.mockResolvedValue([]);

    await getUsersNamesController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [],
      })
    );
  });

  it('should apply role-based filtering in getUsersNames', async () => {
    const req = mockReq({}, { role: 'MERCHANT', userId: 10 });
    const res = mockRes();

    userService.getUsersService.mockResolvedValue([
      { id: 5, name: 'Merchant A' },
    ]);

    await getUsersNamesController(req, res);

    expect(userService.getUsersService).toHaveBeenCalledWith(
        expect.any(Object),
        "MERCHANT",
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
    );
  });

  it('should handle service error in getUsersNames', async () => {
    const req = mockReq({}, { role: 'ADMIN' });
    const res = mockRes();

    userService.getUsersService.mockRejectedValue(new Error('DB error'));

    await expect(getUsersNamesController(req, res)).rejects.toThrow(
      'DB error'
    );
  });


});
describe('User Controller - getByUserName, getById, createUser', () => {
  const mockReq = (data = {}, user = {}) => ({
    body: data,
    params: data,
    query: data,
    user,
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user by username successfully', async () => {
    const req = mockReq({ username: 'john_doe' }, { role: 'ADMIN' });
    const res = mockRes();

    const mockData = {
      id: 1,
      username: 'john_doe',
      name: 'John Doe',
    };

    getUsersService.mockResolvedValue(mockData);

    await getUsersByUserNameController(req, res);

    expect(getUsersService).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'john_doe',
        user: req.user,
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockData,
      })
    );
  });

  it('should return 404 when username not found', async () => {
    const req = mockReq({ username: 'unknown' }, { role: 'ADMIN' });
    const res = mockRes();

    getUsersService.mockResolvedValue(null);

    await getUsersByUserNameController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('should handle service error in getUsersByUserName', async () => {
    const req = mockReq({ username: 'john_doe' }, { role: 'ADMIN' });
    const res = mockRes();

    getUsersService.mockRejectedValue(new Error('DB error'));

    await expect(
      getUsersByUserNameController(req, res)
    ).rejects.toThrow('DB error');
  });

  it('should trim username before searching', async () => {
    const req = mockReq({ username: '  john_doe  ' }, { role: 'ADMIN' });
    const res = mockRes();

    getUsersService.mockResolvedValue({
      id: 1,
      username: 'john_doe',
    });

    await getUsersByUserNameController(req, res);

    expect(getUsersService).toHaveBeenCalledWith(
      expect.objectContaining({
        username: expect.any(String),
      })
    );
  });

  it('should return user by ID successfully', async () => {
    const req = mockReq({ id: 1 }, { role: 'ADMIN' });
    const res = mockRes();

    const mockData = {
      id: 1,
      name: 'John Doe',
    };

    userService.getUserByIdService.mockResolvedValue(mockData);

    await getUserByIdController(req, res);

    expect(userService.getUserByIdService).toHaveBeenCalledWith(1);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockData,
      })
    );
  });

  it('should return 404 when user ID not found', async () => {
    const req = mockReq({ id: 999 }, { role: 'ADMIN' });
    const res = mockRes();

    getUserByIdService.mockResolvedValue(null);

    await getUserByIdController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('should handle invalid ID format', async () => {
    const req = mockReq({ id: 'abc' }, { role: 'ADMIN' });
    const res = mockRes();

    await expect(
      getUserByIdController(req, res)
    ).rejects.toThrow();
  });

  it('should handle service error in getUserById', async () => {
    const req = mockReq({ id: 1 }, { role: 'ADMIN' });
    const res = mockRes();

    getUserByIdService.mockRejectedValue(new Error('DB error'));

    await expect(
      getUserByIdController(req, res)
    ).rejects.toThrow('DB error');
  });

  it('should create user successfully', async () => {
    const req = mockReq(
      {
        username: 'new_user',
        email: 'new@test.com',
        password: 'Password123',
      },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    const mockCreatedUser = {
      id: 10,
      username: 'new_user',
      email: 'new@test.com',
    };

    createUserService.mockResolvedValue(mockCreatedUser);

    await createUserController(req, res);

    expect(createUserService).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'new_user',
        email: 'new@test.com',
        password: 'Password123',
        user: req.user,
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockCreatedUser,
      })
    );
  });

  it('should throw validation error when required fields missing', async () => {
    const req = mockReq(
      { username: '' },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    createUserService.mockRejectedValue(
      new Error('Validation error')
    );

    await expect(
      createUserController(req, res)
    ).rejects.toThrow('Validation error');
  });

  it('should handle duplicate user creation error', async () => {
    const req = mockReq(
      {
        username: 'existing_user',
        email: 'exist@test.com',
        password: 'Password123',
      },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    createUserService.mockRejectedValue(
      new Error('User already exists')
    );

    await expect(
      createUserController(req, res)
    ).rejects.toThrow('User already exists');
  });

  it('should pass correct payload to createUserService', async () => {
    const req = mockReq(
      {
        username: 'test_user',
        email: 'test@test.com',
        password: 'Test123',
        role: 'USER',
      },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    createUserService.mockResolvedValue({
      id: 20,
      username: 'test_user',
    });

    await createUserController(req, res);

    expect(createUserService).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'test_user',
        email: 'test@test.com',
        role: 'USER',
        user: req.user,
      })
    );
  });

  it('should return 500 when unexpected error occurs in createUser', async () => {
    const req = mockReq(
      {
        username: 'fail_user',
        email: 'fail@test.com',
        password: '123456',
      },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    createUserService.mockRejectedValue(
      new Error('Unexpected DB failure')
    );

    await expect(
      createUserController(req, res)
    ).rejects.toThrow('Unexpected DB failure');
  });
});
describe('User Controller - updateUser, mail, 2FA flows', () => {
  const mockReq = (data = {}, user = {}) => ({
    body: data,
    params: data,
    query: data,
    user,
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update user successfully', async () => {
    const req = mockReq(
      { id: 1, name: 'Updated Name', email: 'test@update.com' },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    const mockUpdated = {
      id: 1,
      name: 'Updated Name',
      email: 'test@update.com',
    };

    updateUserService.mockResolvedValue(mockUpdated);

    await updateUserController(req, res);

    expect(updateUserService).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: 'Updated Name',
        email: 'test@update.com',
        user: req.user,
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockUpdated,
      })
    );
  });

  it('should handle updateUser not found case', async () => {
    const req = mockReq({ id: 999, name: 'X' }, { role: 'ADMIN' });
    const res = mockRes();

    updateUserService.mockResolvedValue(null);

    await updateUserController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('should throw error when updateUser service fails', async () => {
    const req = mockReq({ id: 1, name: 'Fail' }, { role: 'ADMIN' });
    const res = mockRes();

    updateUserService.mockRejectedValue(new Error('DB error'));

    await expect(updateUserController(req, res)).rejects.toThrow(
      'DB error'
    );
  });

  it('should send mail successfully', async () => {
    const req = mockReq(
      { email: 'test@mail.com', subject: 'Hello', message: 'Hi' },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    userService.sendMailService.mockResolvedValue({ success: true });

    await sendMailController(req, res);

    expect(userService.sendMailService).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@mail.com',
        subject: 'Hello',
        message: 'Hi',
        user: req.user,
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });

  it('should handle sendMail failure', async () => {
    const req = mockReq(
      { email: 'fail@mail.com' },
      { role: 'ADMIN' }
    );
    const res = mockRes();

    userService.sendMailService.mockRejectedValue(new Error('SMTP error'));

    await expect(sendMailController(req, res)).rejects.toThrow(
      'SMTP error'
    );
  });

  it('should validate required email field in sendMail', async () => {
    const req = mockReq({ subject: 'No email' }, { role: 'ADMIN' });
    const res = mockRes();

    userService.sendMailService.mockRejectedValue(
      new Error('Validation error')
    );

    await expect(sendMailController(req, res)).rejects.toThrow(
      'Validation error'
    );
  });

  it('should reset user 2FA successfully', async () => {
    const req = mockReq({ userId: 2 }, { role: 'ADMIN' });
    const res = mockRes();

    resetUser2FAService.mockResolvedValue({
      userId: 2,
      reset: true,
    });

    await resetUser2FAController(req, res);

    expect(resetUser2FAService).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 2,
        user: req.user,
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });

  it('should handle resetUser2FA failure', async () => {
    const req = mockReq({ userId: 2 }, { role: 'ADMIN' });
    const res = mockRes();

    resetUser2FAService.mockRejectedValue(
      new Error('Reset failed')
    );

    await expect(resetUser2FAController(req, res)).rejects.toThrow(
      'Reset failed'
    );
  });

  it('should enable 2FA exemption successfully', async () => {
    const req = mockReq({ userId: 3, exempt: true }, { role: 'ADMIN' });
    const res = mockRes();

    const mockResult = {
      userId: 3,
      twoFAExempt: true,
    };

    userService.toggleUser2FAExemptionService.mockResolvedValue(mockResult);

    await toggleUser2FAExemptionController(req, res);

    expect(userService.toggleUser2FAExemptionService).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        exempt: true,
        user: req.user,
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should disable 2FA exemption successfully', async () => {
    const req = mockReq({ userId: 3, exempt: false }, { role: 'ADMIN' });
    const res = mockRes();

    userService.toggleUser2FAExemptionService.mockResolvedValue({
      userId: 3,
      twoFAExempt: false,
    });

    await toggleUser2FAExemptionController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle toggleUser2FAExemption failure', async () => {
    const req = mockReq({ userId: 3 }, { role: 'ADMIN' });
    const res = mockRes();

    userService.toggleUser2FAExemptionService.mockRejectedValue(
      new Error('Exemption error')
    );

    await expect(
      userService.toggleUser2FAExemptionController(req, res)
    ).rejects.toThrow('Exemption error');
  });
});

describe("getUsers", () => {
  let req;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: { ...mockUser },
      query: {
        page: "1",
        limit: "10",
      },
    };

    cache.readJsonCache.mockResolvedValue(null);
    cache.shouldServeCachedResponse.mockReturnValue(false);
    cache.writeJsonCache.mockResolvedValue();
  });

  test("should return cached response when cache exists", async () => {
    const cached = {
      Users: [{ id: 1 }],
      totalCount: 1,
    };

    cache.readJsonCache.mockResolvedValue(cached);
    cache.shouldServeCachedResponse.mockReturnValue(true);

    await getUsers(req, mockRes);

    expect(cache.readJsonCache).toHaveBeenCalledTimes(1);

    expect(userService.getUsersService).not.toHaveBeenCalled();

    expect(cache.writeJsonCache).not.toHaveBeenCalled();

    expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
      mockRes,
      cached,
      "getUsers successfully"
    );
  });

  test("should fetch users when cache misses", async () => {
    const serviceData = {
      Users: [{ id: 10 }],
      totalCount: 1,
    };

    userService.getUsersService.mockResolvedValue(serviceData);

    await getUsers(req, mockRes);

    expect(redis.generateCacheKey).toHaveBeenCalled();

    expect(userService.getUsersService).toHaveBeenCalledWith(
        expect.objectContaining({
            company_id: req.user.company_id,
            page: req.query.page,
            limit: req.query.limit,
        }),
        req.user.role,
        req.query.page,
        req.query.limit,
        req.user.designation,
        req.user.user_id,
    );

    expect(cache.writeJsonCache).toHaveBeenCalledTimes(1);

    expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
      mockRes,
      serviceData,
      "getUsers successfully"
    );
  });

  test("should pass additional query filters", async () => {
    req.query = {
      page: "2",
      limit: "20",
      search: "john",
      status: "active",
    };

    userService.getUsersService.mockResolvedValue({
      Users: [],
      totalCount: 0,
    });

    await getUsers(req, mockRes);

    expect(userService.getUsersService).toHaveBeenCalledWith(
      {
        company_id: 10,
        page: "2",
        limit: "20",
        search: "john",
        status: "active",
      },
      Role.ADMIN,
      "2",
      "20",
      Role.ADMIN,
      1
    );
  });

  test("should normalize query before generating cache key", async () => {
    userService.getUsersService.mockResolvedValue({
      Users: [],
      totalCount: 0,
    });

    await getUsers(req, mockRes);

    expect(cache.normalizeQueryForCache).toHaveBeenCalledWith(
      req.query
    );

    expect(redis.generateCacheKey).toHaveBeenCalled();
  });

  test("should write response into cache", async () => {
    const serviceData = {
      Users: [{ id: 5 }],
      totalCount: 1,
    };

    userService.getUsersService.mockResolvedValue(serviceData);

    await getUsers(req, mockRes);

    expect(cache.writeJsonCache).toHaveBeenCalledWith(
      expect.stringContaining("users:read:10:list:"),
      serviceData,
      60
    );
  });

  test("should propagate service errors", async () => {
    const error = new Error("Database failed");

    userService.getUsersService.mockRejectedValue(error);

    await expect(
      getUsers(req, mockRes)
    ).rejects.toThrow("Database failed");

    expect(responseHandlers.sendSuccess).not.toHaveBeenCalled();
  });

  test("should use cache key generator", async () => {
    userService.getUsersService.mockResolvedValue({
      Users: [],
      totalCount: 0,
    });

    await getUsers(req, mockRes);

    expect(redis.generateCacheKey).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 10,
        role: Role.ADMIN,
        user_id: 1,
        designation: Role.ADMIN,
      }),
      "users-list"
    );
  });

  test("should call readJsonCache with generated cache key", async () => {
    userService.getUsersService.mockResolvedValue({
      Users: [],
      totalCount: 0,
    });

    await getUsers(req, mockRes);

    expect(cache.readJsonCache).toHaveBeenCalledWith(
      expect.stringContaining("users:read:10:list:"),
      "Users list cache"
    );
  });
});

describe("updateUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    userService.userUpdateService.mockResolvedValue({
      id: 10,
    });

    invalidateCompanyCacheByPrefix.mockResolvedValue();
  });

  test("should update user successfully", async () => {
    req.user = {
      company_id: 1,
      user_id: 5,
      user_name: "admin",
      designation: Role.ADMIN,
    };

    req.params = {
      id: "10",
    };

    req.body = {
      first_name: "John",
      last_name: "Doe",
    };

    await updateUser(req, res);

    expect(userService.userUpdateService).toHaveBeenCalledWith(
      {
        id: "10",
        company_id: 1,
      },
      {
        first_name: "John",
        last_name: "Doe",
        updated_by: 5,
      },
    );

    expect(invalidateCompanyCacheByPrefix).toHaveBeenCalled();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      {
        id: 10,
        updated_by: "admin",
      },
      "Update user successfully",
    );
  });

  test("should strip immutable fields", async () => {
    req.user = {
      company_id: 1,
      user_id: 5,
      user_name: "admin",
      designation: "USER",
    };

    req.params = {
      id: "20",
    };

    req.body = {
      first_name: "John",
      password: "secret",
      company_id: 99,
      created_by: 88,
      balance: 500,
      role_id: 2,
    };

    await updateUser(req, res);

    expect(userService.userUpdateService).toHaveBeenCalledWith(
      {
        id: "20",
        company_id: 1,
      },
      {
        first_name: "John",
        updated_by: 5,
      },
    );
  });

  test("should allow admin to update privileged fields", async () => {
    req.user = {
      company_id: 1,
      user_id: 2,
      user_name: "superadmin",
      designation: Role.ADMIN,
    };

    req.params = {
      id: "4",
    };

    req.body = {
      role_id: 3,
      designation_id: 5,
      is_two_factor_exempt: true,
    };

    await updateUser(req, res);

    expect(userService.userUpdateService).toHaveBeenCalledWith(
      {
        id: "4",
        company_id: 1,
      },
      {
        role_id: 3,
        designation_id: 5,
        is_two_factor_exempt: true,
        updated_by: 2,
      },
    );
  });

  test("should propagate service error", async () => {
    userService.userUpdateService.mockRejectedValue(new Error("Update failed"));

    req.user = {
      company_id: 1,
      user_id: 5,
      user_name: "admin",
      designation: Role.ADMIN,
    };

    req.params = {
      id: "10",
    };

    req.body = {};

    await expect(updateUser(req, res)).rejects.toThrow("Update failed");
  });
});

describe("sendMail", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    sendMailService.mockResolvedValue(true);
  });

  test("should send mail successfully", async () => {
    req.user = {
      user_name: "admin",
    };

    req.body = {
      user_id: 10,
    };

    await sendMail(req, res);

    expect(sendMailService).toHaveBeenCalledWith({
      user_id: 10,
    });

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      {
        mail_sent_by: "admin",
      },
      "Mail send successfully",
    );
  });

  test("should throw when service fails", async () => {
    sendMailService.mockRejectedValue(new Error("Mail failed"));

    req.user = {
      user_name: "admin",
    };

    req.body = {};

    await expect(sendMail(req, res)).rejects.toThrow("Mail failed");
  });
});

describe("toggleUser2FA", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    updateUser2FAService.mockResolvedValue();
    invalidateCompanyCacheByPrefix.mockResolvedValue();
  });

  test("should enable 2FA requirement", async () => {
    req.params = {
      id: "8",
    };

    req.body = {
      isTwoFactorRequired: true,
    };

    req.user = {
      company_id: 1,
    };

    await toggleUser2FA(req, res);

    expect(updateUser2FAService).toHaveBeenCalledWith(
      "8",
      true,
    );

    expect(invalidateCompanyCacheByPrefix).toHaveBeenCalled();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      {
        id: "8",
        isTwoFactorRequired: true,
      },
      "User 2FA requirement updated successfully",
    );
  });

  test("should disable 2FA requirement", async () => {
    req.params = {
      id: "9",
    };

    req.body = {
      isTwoFactorRequired: false,
    };

    req.user = {
      company_id: 1,
    };

    await toggleUser2FA(req, res);

    expect(updateUser2FAService).toHaveBeenCalledWith(
      "9",
      false,
    );
  });

  test("should throw for invalid boolean", async () => {
    req.params = {
      id: "10",
    };

    req.body = {
      isTwoFactorRequired: "yes",
    };

    req.user = {
      company_id: 1,
    };

    await expect(
      toggleUser2FA(req, res),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  test("should propagate service error", async () => {
    updateUser2FAService.mockRejectedValue(
      new Error("Database error"),
    );

    req.params = {
      id: "11",
    };

    req.body = {
      isTwoFactorRequired: true,
    };

    req.user = {
      company_id: 1,
    };

    await expect(
      toggleUser2FA(req, res),
    ).rejects.toThrow("Database error");
  });
});

describe("resetUser2FA", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    resetUser2FAService.mockResolvedValue();
    invalidateCompanyCacheByPrefix.mockResolvedValue();
  });

  test("should reset user 2FA", async () => {
    req.params = {
      id: "100",
    };

    req.user = {
      user_id: 1,
      user_name: "admin",
      company_id: 10,
    };

    await resetUser2FA(req, res);

    expect(resetUser2FAService).toHaveBeenCalledWith(
      "100",
      1,
      "admin",
    );

    expect(invalidateCompanyCacheByPrefix).toHaveBeenCalled();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      {},
      "2FA has been reset. User must re-enroll on next login.",
    );
  });

  test("should propagate reset error", async () => {
    resetUser2FAService.mockRejectedValue(
      new Error("Reset failed"),
    );

    req.params = {
      id: "100",
    };

    req.user = {
      user_id: 1,
      user_name: "admin",
      company_id: 10,
    };

    await expect(
      resetUser2FA(req, res),
    ).rejects.toThrow("Reset failed");
  });
});

describe("toggleUser2FAExemption", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    toggleUser2FAExemptionService.mockResolvedValue({
      id: 11,
      user_name: "john",
      is_two_factor_exempt: true,
    });

    invalidateCompanyCacheByPrefix.mockResolvedValue();
  });

  test("should grant exemption", async () => {
    req.params = {
      id: "11",
    };

    req.body = {
      exempt: true,
    };

    req.user = {
      company_id: 2,
    };

    await toggleUser2FAExemption(req, res);

    expect(toggleUser2FAExemptionService).toHaveBeenCalledWith(
      "11",
      true,
    );

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      {
        id: 11,
        user_name: "john",
        is_two_factor_exempt: true,
      },
      "User 2FA exemption granted successfully",
    );
  });

  test("should revoke exemption", async () => {
    toggleUser2FAExemptionService.mockResolvedValue({
      id: 11,
      user_name: "john",
      is_two_factor_exempt: false,
    });

    req.params = {
      id: "11",
    };

    req.body = {
      exempt: false,
    };

    req.user = {
      company_id: 2,
    };

    await toggleUser2FAExemption(req, res);

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      {
        id: 11,
        user_name: "john",
        is_two_factor_exempt: false,
      },
      "User 2FA exemption revoked successfully",
    );
  });

  test("should throw BadRequestError for invalid exempt value", async () => {
    req.params = {
      id: "12",
    };

    req.body = {
      exempt: "true",
    };

    req.user = {
      company_id: 2,
    };

    await expect(
      toggleUser2FAExemption(req, res),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  test("should throw when service returns null", async () => {
    toggleUser2FAExemptionService.mockResolvedValue(null);

    req.params = {
      id: "12",
    };

    req.body = {
      exempt: true,
    };

    req.user = {
      company_id: 2,
    };

    await expect(
      toggleUser2FAExemption(req, res),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  test("should propagate service exception", async () => {
    toggleUser2FAExemptionService.mockRejectedValue(
      new Error("DB failed"),
    );

    req.params = {
      id: "12",
    };

    req.body = {
      exempt: true,
    };

    req.user = {
      company_id: 2,
    };

    await expect(
      toggleUser2FAExemption(req, res),
    ).rejects.toThrow("DB failed");
  });
});