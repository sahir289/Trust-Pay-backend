import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/db.js", () => ({
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
}));

jest.unstable_mockModule("./userHierarchyDao.js", () => ({
  createUserHierarchyDao: jest.fn(),
  getUserHierarchysDao: jest.fn(),
  updateUserHierarchyDao: jest.fn(),
  deleteUserHierarchyDao: jest.fn(),
}));

jest.unstable_mockModule("../../helpers/index.js", () => ({
  filterResponse: jest.fn(),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  Role: {
    ADMIN: "ADMIN",
    MERCHANT: "MERCHANT",
  },
  columns: {
    USER_HIERARCHY: ["id", "parent_id", "child_id"],
  },
  merchantColumns: {
    USER_HIERARCHY: ["id", "parent_id"],
  },
}));

const db = await import("../../utils/db.js");
const dao = await import("./userHierarchyDao.js");
const helper = await import("../../helpers/index.js");
const { logger } = await import("../../utils/logger.js");
const { Role, columns, merchantColumns } = await import(
  "../../constants/index.js"
);

const {
    getUserHierarchyService,
    updateUserHierarchyService,
    deleteUserHierarchyService,
    createUserHierarchyService,
} = await import("./userHierarchyService.js");

let conn;
let mockConn;

describe("createUserHierarchyService", () => {

  beforeEach(() => {
    jest.clearAllMocks();

    conn = {
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValue(conn);
    db.beginTransaction.mockResolvedValue();
    db.commit.mockResolvedValue();
    db.rollback.mockResolvedValue();
  });

  it("should create user hierarchy successfully for ADMIN", async () => {
    const payload = {
      parent_id: 1,
      child_id: 2,
    };

    const daoResult = {
      id: 10,
      parent_id: 1,
      child_id: 2,
    };

    const filtered = {
      id: 10,
    };

    dao.createUserHierarchyDao.mockResolvedValue(daoResult);

    helper.filterResponse.mockReturnValue(filtered);

    const result = await createUserHierarchyService(
      payload,
      Role.ADMIN
    );

    expect(db.getConnection).toHaveBeenCalled();

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);

    expect(dao.createUserHierarchyDao).toHaveBeenCalledWith(
      payload,
      conn
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      columns.USER_HIERARCHY
    );

    expect(db.commit).toHaveBeenCalledWith(conn);

    expect(result).toEqual(filtered);

    expect(conn.release).toHaveBeenCalled();
  });

  it("should create user hierarchy successfully for MERCHANT", async () => {
    const payload = {
      parent_id: 5,
      child_id: 8,
    };

    const daoResult = {
      id: 11,
    };

    helper.filterResponse.mockReturnValue({
      id: 11,
    });

    dao.createUserHierarchyDao.mockResolvedValue(
      daoResult
    );

    await createUserHierarchyService(
      payload,
      Role.MERCHANT
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      merchantColumns.USER_HIERARCHY
    );

    expect(db.commit).toHaveBeenCalledWith(conn);

    expect(conn.release).toHaveBeenCalled();
  });

  it("should rollback when DAO throws error", async () => {
    const error = new Error("DAO Error");

    dao.createUserHierarchyDao.mockRejectedValue(error);

    await expect(
      createUserHierarchyService(
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);

    expect(db.rollback).toHaveBeenCalledWith(conn);

    expect(db.commit).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "error in _createUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while creating UserHierarchy",
      error
    );

    expect(conn.release).toHaveBeenCalled();
  });

  it("should throw when getConnection fails", async () => {
    const error = new Error("Connection Error");

    db.getConnection.mockRejectedValue(error);

    await expect(
      createUserHierarchyService(
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.beginTransaction).not.toHaveBeenCalled();

    expect(db.rollback).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "Error while creating UserHierarchy",
      error
    );
  });

  it("should rollback when commit fails", async () => {
    const error = new Error("Commit Error");

    dao.createUserHierarchyDao.mockResolvedValue({
      id: 1,
    });

    helper.filterResponse.mockReturnValue({
      id: 1,
    });

    db.commit.mockRejectedValue(error);

    await expect(
      createUserHierarchyService(
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.commit).toHaveBeenCalledWith(conn);

    expect(db.rollback).toHaveBeenCalledWith(conn);

    expect(logger.error).toHaveBeenCalledWith(
      "Error while creating UserHierarchy",
      error
    );

    expect(conn.release).toHaveBeenCalled();
  });

  it("should always release connection even after rollback", async () => {
    const error = new Error("Failure");

    dao.createUserHierarchyDao.mockRejectedValue(error);

    await expect(
      createUserHierarchyService(
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should always release connection after success", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({
      id: 99,
    });

    helper.filterResponse.mockReturnValue({
      id: 99,
    });

    await createUserHierarchyService(
      {},
      Role.ADMIN
    );

    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

describe("createUserHierarchyService - new", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    conn = {
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValue(conn);
    db.beginTransaction.mockResolvedValue();
    db.commit.mockResolvedValue();
    db.rollback.mockResolvedValue();
  });

  it("should create user hierarchy successfully for ADMIN role", async () => {
    const payload = { parent_id: 1, child_id: 2 };
    const daoResult = { id: 10, ...payload };
    const filtered = { id: 10 };

    dao.createUserHierarchyDao.mockResolvedValue(daoResult);
    helper.filterResponse.mockReturnValue(filtered);

    const result = await createUserHierarchyService(
      payload,
      Role.ADMIN
    );

    expect(result).toEqual(filtered);

    expect(dao.createUserHierarchyDao).toHaveBeenCalledWith(
      payload,
      conn
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      columns.USER_HIERARCHY
    );

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);
    expect(db.commit).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
  });

  it("should create user hierarchy successfully for MERCHANT role", async () => {
    const payload = { parent_id: 5, child_id: 9 };
    const daoResult = { id: 5 };
    const filtered = { id: 5 };

    dao.createUserHierarchyDao.mockResolvedValue(daoResult);
    helper.filterResponse.mockReturnValue(filtered);

    const result = await createUserHierarchyService(
      payload,
      Role.MERCHANT
    );

    expect(result).toEqual(filtered);

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      merchantColumns.USER_HIERARCHY
    );
  });

  it("should use merchant filter columns for MERCHANT role", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.MERCHANT);

    expect(helper.filterResponse).toHaveBeenCalledWith(
      {},
      merchantColumns.USER_HIERARCHY
    );
  });

  it("should use default filter columns for non-MERCHANT roles", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.ADMIN);

    expect(helper.filterResponse).toHaveBeenCalledWith(
      {},
      columns.USER_HIERARCHY
    );
  });

  it("should begin transaction before creating hierarchy", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.ADMIN);

    expect(db.beginTransaction.mock.invocationCallOrder[0]).toBeLessThan(
    dao.createUserHierarchyDao.mock.invocationCallOrder[0]
    );
  });

  it("should commit transaction after successful creation", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.ADMIN);

    expect(db.commit).toHaveBeenCalledWith(conn);
    expect(db.rollback).not.toHaveBeenCalled();
  });

  it("should rollback transaction when createUserHierarchyDao throws an error", async () => {
    const error = new Error("dao failed");

    dao.createUserHierarchyDao.mockRejectedValue(error);

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
    expect(db.commit).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "error in _createUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while creating UserHierarchy",
      error
    );
  });

  it("should release database connection after successful transaction", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.ADMIN);

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should release database connection after rollback", async () => {
    const error = new Error("dao");

    dao.createUserHierarchyDao.mockRejectedValue(error);

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should call filterResponse with correct filter columns", async () => {
    const daoResult = { id: 1 };

    dao.createUserHierarchyDao.mockResolvedValue(daoResult);
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.ADMIN);

    expect(helper.filterResponse).toHaveBeenCalledTimes(1);

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      columns.USER_HIERARCHY
    );
  });

  it("should propagate DAO errors", async () => {
    const error = new Error("dao");

    dao.createUserHierarchyDao.mockRejectedValue(error);

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);
  });

  it("should propagate filterResponse errors", async () => {
    const error = new Error("filter");

    dao.createUserHierarchyDao.mockResolvedValue({});

    helper.filterResponse.mockImplementation(() => {
      throw error;
    });

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
  });

  it("should handle getConnection failure", async () => {
    const error = new Error("connection");

    db.getConnection.mockRejectedValue(error);

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "Error while creating UserHierarchy",
      error
    );
  });

  it("should handle beginTransaction failure", async () => {
    const error = new Error("begin");

    db.beginTransaction.mockRejectedValue(error);

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);

    expect(conn.release).toHaveBeenCalled();
  });

  it("should handle commit failure", async () => {
    const error = new Error("commit");

    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    db.commit.mockRejectedValue(error);

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);

    expect(conn.release).toHaveBeenCalled();
  });

  it("should handle rollback failure gracefully", async () => {
    const daoError = new Error("dao");
    const rollbackError = new Error("rollback");

    dao.createUserHierarchyDao.mockRejectedValue(daoError);

    db.rollback.mockRejectedValue(rollbackError);

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(rollbackError);

    expect(conn.release).toHaveBeenCalled();
  });

  it("should handle empty payload during create operation", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.ADMIN);

    expect(dao.createUserHierarchyDao).toHaveBeenCalledWith(
      {},
      conn
    );
  });

  it("should return filtered response correctly", async () => {
    const filtered = {
      id: 100,
      parent_id: 1,
    };

    dao.createUserHierarchyDao.mockResolvedValue({
      id: 100,
      parent_id: 1,
      child_id: 5,
    });

    helper.filterResponse.mockReturnValue(filtered);

    const result = await createUserHierarchyService(
      {},
      Role.ADMIN
    );

    expect(result).toEqual(filtered);
  });

  it("should execute DAO with provided transaction connection", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.ADMIN);

    expect(
      dao.createUserHierarchyDao.mock.calls[0][1]
    ).toBe(conn);
  });

  it("should preserve transaction integrity when multiple operations fail", async () => {
    const error = new Error("dao");

    dao.createUserHierarchyDao.mockRejectedValue(error);

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.commit).not.toHaveBeenCalled();
    expect(db.rollback).toHaveBeenCalledTimes(1);
  });

  it("should not call commit after rollback", async () => {
    dao.createUserHierarchyDao.mockRejectedValue(
      new Error("dao")
    );

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow();

    expect(db.rollback).toHaveBeenCalled();
    expect(db.commit).not.toHaveBeenCalled();
  });

  it("should not call rollback after successful commit", async () => {
    dao.createUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await createUserHierarchyService({}, Role.ADMIN);

    expect(db.commit).toHaveBeenCalled();
    expect(db.rollback).not.toHaveBeenCalled();
  });

  it("should handle unexpected runtime errors gracefully", async () => {
    const error = new Error("runtime");

    helper.filterResponse.mockImplementation(() => {
      throw error;
    });

    dao.createUserHierarchyDao.mockResolvedValue({});

    await expect(
      createUserHierarchyService({}, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      "error in _createUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while creating UserHierarchy",
      error
    );
  });
});

describe("getUserHierarchyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return user hierarchies for ADMIN role", async () => {
    const filters = {
      company_id: 1,
    };

    const response = {
      rows: [{ id: 1 }],
      total: 1,
    };

    dao.getUserHierarchysDao.mockResolvedValue(response);

    const result = await getUserHierarchyService(
      filters,
      Role.ADMIN,
      "1",
      "10"
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      filters,
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );

    expect(result).toEqual(response);
  });

  it("should return user hierarchies for MERCHANT role", async () => {
    const filters = {
      company_id: 2,
    };

    const response = {
      rows: [{ id: 5 }],
      total: 1,
    };

    dao.getUserHierarchysDao.mockResolvedValue(response);

    const result = await getUserHierarchyService(
      filters,
      Role.MERCHANT,
      "2",
      "25"
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      filters,
      2,
      25,
      null,
      null,
      merchantColumns.USER_HIERARCHY
    );

    expect(result).toEqual(response);
  });

  it("should use default pagination when page and limit are undefined", async () => {
    dao.getUserHierarchysDao.mockResolvedValue({
      rows: [],
      total: 0,
    });

    await getUserHierarchyService(
      {},
      Role.ADMIN
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should use default pagination for invalid page and limit", async () => {
    dao.getUserHierarchysDao.mockResolvedValue({
      rows: [],
      total: 0,
    });

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      "abc",
      "xyz"
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should parse numeric string pagination correctly", async () => {
    dao.getUserHierarchysDao.mockResolvedValue({
      rows: [],
      total: 0,
    });

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      "5",
      "50"
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      5,
      50,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should support zero values by falling back to defaults", async () => {
    dao.getUserHierarchysDao.mockResolvedValue({
      rows: [],
      total: 0,
    });

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      "0",
      "0"
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should throw when DAO throws", async () => {
    const error = new Error("DAO Error");

    dao.getUserHierarchysDao.mockRejectedValue(error);

    await expect(
      getUserHierarchyService(
        {},
        Role.ADMIN,
        "1",
        "10"
      )
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      "Error while fetching UserHierarchys",
      error
    );
  });

  it("should pass filters unchanged to DAO", async () => {
    const filters = {
      company_id: 10,
      parent_id: 20,
      child_id: 30,
      status: true,
    };

    dao.getUserHierarchysDao.mockResolvedValue({
      rows: [],
      total: 0,
    });

    await getUserHierarchyService(
      filters,
      Role.ADMIN,
      3,
      15
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      filters,
      3,
      15,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });
});

describe("getUserHierarchyService - new", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return paginated user hierarchy records", async () => {
    const rows = [{ id: 1 }, { id: 2 }];

    dao.getUserHierarchysDao.mockResolvedValue(rows);

    const result = await getUserHierarchyService(
      { parent_id: 1 },
      Role.ADMIN,
      2,
      20
    );

    expect(result).toEqual(rows);

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      { parent_id: 1 },
      2,
      20,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should use merchant filter columns for MERCHANT role", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.MERCHANT,
      1,
      10
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      merchantColumns.USER_HIERARCHY
    );
  });

  it("should use default filter columns for non-MERCHANT roles", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      1,
      10
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should default page to 1 when page is invalid", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      "abc",
      10
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should default limit to 10 when limit is invalid", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      1,
      "abc"
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should correctly parse page and limit as integers", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      "5",
      "15"
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      5,
      15,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should pass filters to getUserHierarchysDao correctly", async () => {
    const filters = {
      parent_id: 11,
      child_id: 20,
      status: true,
    };

    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      filters,
      Role.ADMIN,
      1,
      10
    );

    expect(
      dao.getUserHierarchysDao.mock.calls[0][0]
    ).toEqual(filters);
  });

  it("should return empty array when no records exist", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    const result = await getUserHierarchyService(
      {},
      Role.ADMIN,
      1,
      10
    );

    expect(result).toEqual([]);
  });

  it("should propagate DAO errors", async () => {
    const error = new Error("DAO Error");

    dao.getUserHierarchysDao.mockRejectedValue(error);

    await expect(
      getUserHierarchyService(
        {},
        Role.ADMIN,
        1,
        10
      )
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      "Error while fetching UserHierarchys",
      error
    );
  });

  it("should handle undefined filters", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      undefined,
      Role.ADMIN,
      1,
      10
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      undefined,
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should handle null page and limit values", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      null,
      null
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should use defaults when page and limit are undefined", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should use defaults when page and limit are empty strings", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      "",
      ""
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should use defaults when page and limit are zero", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      0,
      0
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      1,
      10,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should truncate decimal page and limit values", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      "3.9",
      "8.7"
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      3,
      8,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should allow negative page and limit values", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      -2,
      -5
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledWith(
      {},
      -2,
      -5,
      null,
      null,
      columns.USER_HIERARCHY
    );
  });

  it("should preserve filter object reference", async () => {
    const filters = { id: 99 };

    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      filters,
      Role.ADMIN,
      1,
      10
    );

    expect(
      dao.getUserHierarchysDao.mock.calls[0][0]
    ).toBe(filters);
  });

  it("should call DAO exactly once", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      1,
      10
    );

    expect(dao.getUserHierarchysDao).toHaveBeenCalledTimes(1);
  });

  it("should not call filterResponse helper", async () => {
    dao.getUserHierarchysDao.mockResolvedValue([]);

    await getUserHierarchyService(
      {},
      Role.ADMIN,
      1,
      10
    );

    expect(helper.filterResponse).not.toHaveBeenCalled();
  });

  it("should log DAO errors exactly once", async () => {
    const error = new Error("failure");

    dao.getUserHierarchysDao.mockRejectedValue(error);

    await expect(
      getUserHierarchyService(
        {},
        Role.ADMIN,
        1,
        10
      )
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      "Error while fetching UserHierarchys",
      error
    );
  });

  it("should handle unexpected runtime errors gracefully", async () => {
    const error = new Error("runtime");

    dao.getUserHierarchysDao.mockImplementation(() => {
      throw error;
    });

    await expect(
      getUserHierarchyService(
        {},
        Role.ADMIN,
        1,
        10
      )
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      "Error while fetching UserHierarchys",
      error
    );
  });
});

describe("updateUserHierarchyService", () => {

  beforeEach(() => {
    jest.clearAllMocks();

    conn = {
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValue(conn);
    db.beginTransaction.mockResolvedValue();
    db.commit.mockResolvedValue();
    db.rollback.mockResolvedValue();
  });

  it("should update user hierarchy successfully for ADMIN", async () => {
    const id = 1;
    const payload = {
      parent_id: 10,
    };

    const daoResult = {
      id,
      parent_id: 10,
    };

    const filtered = {
      id,
    };

    dao.updateUserHierarchyDao.mockResolvedValue(daoResult);

    helper.filterResponse.mockResolvedValue(filtered);

    const result = await updateUserHierarchyService(
      id,
      payload,
      Role.ADMIN
    );

    expect(db.getConnection).toHaveBeenCalled();

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);

    expect(dao.updateUserHierarchyDao).toHaveBeenCalledWith(
      id,
      payload,
      conn
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      columns.USER_HIERARCHY
    );

    expect(db.commit).toHaveBeenCalledWith(conn);

    expect(result).toEqual(filtered);

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should update user hierarchy successfully for MERCHANT", async () => {
    const id = 5;
    const payload = {
      child_id: 20,
    };

    dao.updateUserHierarchyDao.mockResolvedValue({
      id,
    });

    helper.filterResponse.mockResolvedValue({
      id,
    });

    await updateUserHierarchyService(
      id,
      payload,
      Role.MERCHANT
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      { id },
      merchantColumns.USER_HIERARCHY
    );

    expect(db.commit).toHaveBeenCalledWith(conn);

    expect(conn.release).toHaveBeenCalled();
  });

  it("should rollback when DAO throws error", async () => {
    const error = new Error("DAO Error");

    dao.updateUserHierarchyDao.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);

    expect(db.rollback).toHaveBeenCalledWith(conn);

    expect(db.commit).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "error in _updateUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while updating UserHierarchy",
      error
    );

    expect(conn.release).toHaveBeenCalled();
  });

  it("should rollback when filterResponse throws", async () => {
    const error = new Error("Filter Error");

    dao.updateUserHierarchyDao.mockResolvedValue({
      id: 1,
    });

    helper.filterResponse.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);

    expect(db.commit).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "error in _updateUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while updating UserHierarchy",
      error
    );

    expect(conn.release).toHaveBeenCalled();
  });

  it("should rollback when commit fails", async () => {
    const error = new Error("Commit Error");

    dao.updateUserHierarchyDao.mockResolvedValue({
      id: 1,
    });

    helper.filterResponse.mockResolvedValue({
      id: 1,
    });

    db.commit.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.commit).toHaveBeenCalledWith(conn);

    expect(db.rollback).toHaveBeenCalledWith(conn);

    expect(logger.error).toHaveBeenCalledWith(
      "Error while updating UserHierarchy",
      error
    );

    expect(conn.release).toHaveBeenCalled();
  });

  it("should throw when getConnection fails", async () => {
    const error = new Error("Connection Error");

    db.getConnection.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.beginTransaction).not.toHaveBeenCalled();

    expect(db.rollback).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "Error while updating UserHierarchy",
      error
    );
  });

  it("should always release connection after success", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({
      id: 100,
    });

    helper.filterResponse.mockResolvedValue({
      id: 100,
    });

    await updateUserHierarchyService(
      100,
      {},
      Role.ADMIN
    );

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should always release connection after rollback", async () => {
    const error = new Error("Update Failed");

    dao.updateUserHierarchyDao.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        10,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

describe("updateUserHierarchyService - new", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    conn = {
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValue(conn);
    db.beginTransaction.mockResolvedValue();
    db.commit.mockResolvedValue();
    db.rollback.mockResolvedValue();
  });

  it("should update user hierarchy successfully", async () => {
    const payload = { parent_id: 5 };
    const daoResult = { id: 1, ...payload };
    const filtered = { id: 1 };

    dao.updateUserHierarchyDao.mockResolvedValue(daoResult);
    helper.filterResponse.mockReturnValue(filtered);

    const result = await updateUserHierarchyService(
      1,
      payload,
      Role.ADMIN
    );

    expect(result).toEqual(filtered);

    expect(dao.updateUserHierarchyDao).toHaveBeenCalledWith(
      1,
      payload,
      conn
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      columns.USER_HIERARCHY
    );

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);
    expect(db.commit).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
  });

  it("should update user hierarchy for MERCHANT role", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({ id: 5 });
    helper.filterResponse.mockReturnValue({ id: 5 });

    await updateUserHierarchyService(
      5,
      {},
      Role.MERCHANT
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      { id: 5 },
      merchantColumns.USER_HIERARCHY
    );
  });

  it("should use merchant filter columns for MERCHANT role", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.MERCHANT
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      {},
      merchantColumns.USER_HIERARCHY
    );
  });

  it("should use default filter columns for non-MERCHANT role", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      {},
      columns.USER_HIERARCHY
    );
  });

  it("should begin transaction before update", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);
  });

  it("should commit transaction after successful update", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(db.commit).toHaveBeenCalledWith(conn);
    expect(db.rollback).not.toHaveBeenCalled();
  });

  it("should rollback transaction when updateUserHierarchyDao throws", async () => {
    const error = new Error("DAO Error");

    dao.updateUserHierarchyDao.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
    expect(db.commit).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "error in _updateUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while updating UserHierarchy",
      error
    );
  });

  it("should release connection after successful update", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should release connection after rollback", async () => {
    dao.updateUserHierarchyDao.mockRejectedValue(
      new Error("dao")
    );

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow();

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should call filterResponse with updated data", async () => {
    const daoResult = { id: 100 };

    dao.updateUserHierarchyDao.mockResolvedValue(daoResult);
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      100,
      {},
      Role.ADMIN
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      columns.USER_HIERARCHY
    );
  });

  it("should propagate DAO errors", async () => {
    const error = new Error("dao");

    dao.updateUserHierarchyDao.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);
  });

  it("should propagate filterResponse errors", async () => {
    const error = new Error("filter");

    dao.updateUserHierarchyDao.mockResolvedValue({});

    helper.filterResponse.mockImplementation(() => {
      throw error;
    });

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
  });

  it("should handle getConnection failure", async () => {
    const error = new Error("connection");

    db.getConnection.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.rollback).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "Error while updating UserHierarchy",
      error
    );
  });

  it("should handle beginTransaction failure", async () => {
    const error = new Error("begin");

    db.beginTransaction.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
  });

  it("should handle commit failure", async () => {
    const error = new Error("commit");

    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    db.commit.mockRejectedValue(error);

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
  });

  it("should handle rollback failure gracefully", async () => {
    dao.updateUserHierarchyDao.mockRejectedValue(
      new Error("dao")
    );

    db.rollback.mockRejectedValue(
      new Error("rollback")
    );

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow("rollback");

    expect(conn.release).toHaveBeenCalled();
  });

  it("should handle empty update payload", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(dao.updateUserHierarchyDao).toHaveBeenCalledWith(
      1,
      {},
      conn
    );
  });

  it("should execute DAO with transaction connection", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      20,
      {},
      Role.ADMIN
    );

    expect(
      dao.updateUserHierarchyDao.mock.calls[0][2]
    ).toBe(conn);
  });

  it("should return filtered response correctly", async () => {
    const filtered = { id: 99 };

    dao.updateUserHierarchyDao.mockResolvedValue({
      id: 99,
      child_id: 10,
    });

    helper.filterResponse.mockReturnValue(filtered);

    const result = await updateUserHierarchyService(
      99,
      {},
      Role.ADMIN
    );

    expect(result).toEqual(filtered);
  });

  it("should call update DAO exactly once", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(
      dao.updateUserHierarchyDao
    ).toHaveBeenCalledTimes(1);
  });

  it("should call filterResponse exactly once", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(helper.filterResponse).toHaveBeenCalledTimes(1);
  });

  it("should call commit exactly once on success", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(db.commit).toHaveBeenCalledTimes(1);
  });

  it("should not call commit after rollback", async () => {
    dao.updateUserHierarchyDao.mockRejectedValue(
      new Error("dao")
    );

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow();

    expect(db.rollback).toHaveBeenCalled();
    expect(db.commit).not.toHaveBeenCalled();
  });

  it("should not call rollback after successful commit", async () => {
    dao.updateUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await updateUserHierarchyService(
      1,
      {},
      Role.ADMIN
    );

    expect(db.commit).toHaveBeenCalled();
    expect(db.rollback).not.toHaveBeenCalled();
  });

  it("should log internal update errors", async () => {
    const error = new Error("filter");

    dao.updateUserHierarchyDao.mockResolvedValue({});

    helper.filterResponse.mockImplementation(() => {
      throw error;
    });

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      "error in _updateUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while updating UserHierarchy",
      error
    );
  });

  it("should handle unexpected runtime errors gracefully", async () => {
    const error = new Error("runtime");

    dao.updateUserHierarchyDao.mockImplementation(() => {
      throw error;
    });

    await expect(
      updateUserHierarchyService(
        1,
        {},
        Role.ADMIN
      )
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      "error in _updateUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while updating UserHierarchy",
      error
    );
  });
});

describe("deleteUserHierarchyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    conn = {
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValue(conn);
    db.beginTransaction.mockResolvedValue();
    db.commit.mockResolvedValue();
    db.rollback.mockResolvedValue();

    helper.filterResponse.mockImplementation((d) => d);
  });

  it("should delete hierarchy successfully for ADMIN", async () => {
    const daoResult = {
      id: 1,
      is_obsolete: true,
      updated_by: 100,
    };

    dao.deleteUserHierarchyDao.mockResolvedValue(daoResult);

    helper.filterResponse.mockReturnValue({
      id: 1,
      is_obsolete: true,
    });

    const result = await deleteUserHierarchyService(
      { id: 1 },
      100,
      Role.ADMIN
    );

    expect(dao.deleteUserHierarchyDao).toHaveBeenCalledWith(
      { id: 1 },
      {
        is_obsolete: true,
        updated_by: 100,
      },
      conn
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      columns.USER_HIERARCHY
    );

    expect(db.commit).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(result).toEqual({
      id: 1,
      is_obsolete: true,
    });
  });

  it("should delete hierarchy successfully for MERCHANT", async () => {
    const daoResult = {
      id: 2,
      is_obsolete: true,
    };

    dao.deleteUserHierarchyDao.mockResolvedValue(daoResult);

    await deleteUserHierarchyService(
      { id: 2 },
      500,
      Role.MERCHANT
    );

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      merchantColumns.USER_HIERARCHY
    );

    expect(db.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it("should pass correct payload to delete DAO", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});

    await deleteUserHierarchyService(
      { id: 77 },
      900,
      Role.ADMIN
    );

    expect(dao.deleteUserHierarchyDao).toHaveBeenCalledWith(
      { id: 77 },
      {
        is_obsolete: true,
        updated_by: 900,
      },
      conn
    );
  });

  it("should rollback when delete DAO throws", async () => {
    const error = new Error("delete failed");

    dao.deleteUserHierarchyDao.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService(
        { id: 1 },
        10,
        Role.ADMIN
      )
    ).rejects.toThrow("delete failed");

    expect(db.rollback).toHaveBeenCalledWith(conn);
    expect(db.commit).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Error while deleting UserHierarchy",
      error
    );
    expect(conn.release).toHaveBeenCalled();
  });

  it("should rollback when filterResponse throws", async () => {
    const error = new Error("filter failed");

    dao.deleteUserHierarchyDao.mockResolvedValue({});

    helper.filterResponse.mockImplementation(() => {
      throw error;
    });

    await expect(
      deleteUserHierarchyService(
        { id: 1 },
        20,
        Role.ADMIN
      )
    ).rejects.toThrow("filter failed");

    expect(db.rollback).toHaveBeenCalledWith(conn);
    expect(db.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it("should rollback when commit fails", async () => {
    const error = new Error("commit failed");

    dao.deleteUserHierarchyDao.mockResolvedValue({});
    db.commit.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService(
        { id: 1 },
        50,
        Role.ADMIN
      )
    ).rejects.toThrow("commit failed");

    expect(db.rollback).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
  });

  it("should not rollback when getConnection fails", async () => {
    const error = new Error("connection failed");

    db.getConnection.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService(
        { id: 1 },
        10,
        Role.ADMIN
      )
    ).rejects.toThrow("connection failed");

    expect(db.rollback).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Error while deleting UserHierarchy",
      error
    );
  });

  it("should always release connection after rollback", async () => {
    const error = new Error("dao error");

    dao.deleteUserHierarchyDao.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService(
        { id: 5 },
        100,
        Role.ADMIN
      )
    ).rejects.toThrow();

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should always release connection after success", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});

    await deleteUserHierarchyService(
      { id: 10 },
      101,
      Role.ADMIN
    );

    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it("should begin transaction before deleting", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});

    await deleteUserHierarchyService(
      { id: 9 },
      11,
      Role.ADMIN
    );

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);
    expect(dao.deleteUserHierarchyDao).toHaveBeenCalled();
    expect(db.commit).toHaveBeenCalled();
  });

  it("should call delete DAO exactly once", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});

    await deleteUserHierarchyService(
      { id: 1 },
      2,
      Role.ADMIN
    );

    expect(dao.deleteUserHierarchyDao).toHaveBeenCalledTimes(1);
  });

  it("should call filterResponse exactly once", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});

    await deleteUserHierarchyService(
      { id: 1 },
      2,
      Role.ADMIN
    );

    expect(helper.filterResponse).toHaveBeenCalledTimes(1);
  });

  it("should call commit exactly once on success", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});

    await deleteUserHierarchyService(
      { id: 1 },
      2,
      Role.ADMIN
    );

    expect(db.commit).toHaveBeenCalledTimes(1);
  });

  it("should not call commit when DAO fails", async () => {
    dao.deleteUserHierarchyDao.mockRejectedValue(new Error("failed"));

    await expect(
      deleteUserHierarchyService(
        { id: 1 },
        2,
        Role.ADMIN
      )
    ).rejects.toThrow();

    expect(db.commit).not.toHaveBeenCalled();
  });

  it("should log internal delete errors", async () => {
    const error = new Error("internal");

    dao.deleteUserHierarchyDao.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService(
        { id: 5 },
        2,
        Role.ADMIN
      )
    ).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      "error in _deleteUserHierarchyServiceInternal",
      error
    );
  });
});
describe("deleteUserHierarchyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockConn = {
      release: jest.fn(),
    };

    conn = mockConn;

    db.getConnection.mockResolvedValue(conn);
    db.beginTransaction.mockResolvedValue();
    db.commit.mockResolvedValue();
    db.rollback.mockResolvedValue();
  });

  it("should soft delete user hierarchy successfully", async () => {
    const daoResult = { id: 1, is_obsolete: true };
    const filtered = { id: 1 };

    dao.deleteUserHierarchyDao.mockResolvedValue(daoResult);
    helper.filterResponse.mockReturnValue(filtered);

    const result = await deleteUserHierarchyService(
      [1],
      100,
      Role.ADMIN
    );

    expect(result).toEqual(filtered);
  });

  it("should mark is_obsolete as true before deleting", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService([5], 10, Role.ADMIN);

    expect(dao.deleteUserHierarchyDao).toHaveBeenCalledWith(
      [5],
      {
        is_obsolete: true,
        updated_by: 10,
      },
      conn
    );
  });

  it("should pass updated_by to deleteUserHierarchyDao", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService([8], 999, Role.ADMIN);

    expect(dao.deleteUserHierarchyDao.mock.calls[0][1].updated_by).toBe(999);
  });

  it("should use merchant filter columns for MERCHANT role", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService([1], 5, Role.MERCHANT);

    expect(helper.filterResponse).toHaveBeenCalledWith(
      {},
      merchantColumns.USER_HIERARCHY
    );
  });

  it("should use default filter columns for non-MERCHANT role", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService([1], 5, Role.ADMIN);

    expect(helper.filterResponse).toHaveBeenCalledWith(
      {},
      columns.USER_HIERARCHY
    );
  });

  it("should begin transaction before delete", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService([1], 1, Role.ADMIN);

    expect(db.beginTransaction).toHaveBeenCalledWith(conn);
  });

  it("should commit transaction after successful delete", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService([1], 1, Role.ADMIN);

    expect(db.commit).toHaveBeenCalledWith(conn);
  });

  it("should rollback transaction when deleteUserHierarchyDao throws", async () => {
    const error = new Error("dao failed");

    dao.deleteUserHierarchyDao.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService([1], 2, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
    expect(db.commit).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "error in _deleteUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while deleting UserHierarchy",
      error
    );
  });

  it("should release connection after successful delete", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService([1], 1, Role.ADMIN);

    expect(conn.release).toHaveBeenCalled();
  });

  it("should release connection after rollback", async () => {
    const error = new Error("failed");

    dao.deleteUserHierarchyDao.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService([1], 1, Role.ADMIN)
    ).rejects.toThrow();

    expect(conn.release).toHaveBeenCalled();
  });

  it("should call filterResponse with deleted data", async () => {
    const daoResult = { id: 100 };

    dao.deleteUserHierarchyDao.mockResolvedValue(daoResult);
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService([1], 2, Role.ADMIN);

    expect(helper.filterResponse).toHaveBeenCalledWith(
      daoResult,
      columns.USER_HIERARCHY
    );
  });

  it("should propagate DAO errors", async () => {
    const error = new Error("dao");

    dao.deleteUserHierarchyDao.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService([1], 2, Role.ADMIN)
    ).rejects.toThrow(error);
  });

  it("should propagate filterResponse errors", async () => {
    const error = new Error("filter");

    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockImplementation(() => {
      throw error;
    });

    await expect(
      deleteUserHierarchyService([1], 2, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
  });

  it("should handle getConnection failure", async () => {
    const error = new Error("connection");

    db.getConnection.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService([1], 1, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "Error while deleting UserHierarchy",
      error
    );
  });

  it("should handle beginTransaction failure", async () => {
    const error = new Error("begin");

    db.beginTransaction.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService([1], 1, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
  });

  it("should handle commit failure", async () => {
    const error = new Error("commit");

    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    db.commit.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService([1], 1, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.rollback).toHaveBeenCalledWith(conn);
  });

  it("should handle rollback failure gracefully", async () => {
    const error = new Error("dao");
    const rollbackError = new Error("rollback");

    dao.deleteUserHierarchyDao.mockRejectedValue(error);
    db.rollback.mockRejectedValue(rollbackError);

    await expect(
      deleteUserHierarchyService([1], 1, Role.ADMIN)
    ).rejects.toThrow(rollbackError);

    expect(conn.release).toHaveBeenCalled();
  });

  it("should handle empty ids array during delete", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue([]);
    helper.filterResponse.mockReturnValue([]);

    const result = await deleteUserHierarchyService(
      [],
      1,
      Role.ADMIN
    );

    expect(result).toEqual([]);
  });

  it("should handle null updated_by during delete", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService(
      [1],
      null,
      Role.ADMIN
    );

    expect(dao.deleteUserHierarchyDao).toHaveBeenCalledWith(
      [1],
      {
        is_obsolete: true,
        updated_by: null,
      },
      conn
    );
  });

  it("should return filtered response correctly", async () => {
    const filtered = { success: true };

    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue(filtered);

    const result = await deleteUserHierarchyService(
      [10],
      22,
      Role.ADMIN
    );

    expect(result).toEqual(filtered);
  });

  it("should preserve transaction integrity when multiple operations fail", async () => {
    const error = new Error("dao");

    dao.deleteUserHierarchyDao.mockRejectedValue(error);

    await expect(
      deleteUserHierarchyService([1], 1, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(db.commit).not.toHaveBeenCalled();
    expect(db.rollback).toHaveBeenCalled();
  });

  it("should not call commit after rollback", async () => {
    dao.deleteUserHierarchyDao.mockRejectedValue(
      new Error("dao")
    );

    await expect(
      deleteUserHierarchyService([1], 1, Role.ADMIN)
    ).rejects.toThrow();

    expect(db.commit).not.toHaveBeenCalled();
  });

  it("should not call rollback after successful commit", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService(
      [1],
      1,
      Role.ADMIN
    );

    expect(db.rollback).not.toHaveBeenCalled();
  });

  it("should execute DAO with provided transaction connection", async () => {
    dao.deleteUserHierarchyDao.mockResolvedValue({});
    helper.filterResponse.mockReturnValue({});

    await deleteUserHierarchyService(
      [5],
      7,
      Role.ADMIN
    );

    expect(dao.deleteUserHierarchyDao.mock.calls[0][2]).toBe(conn);
  });

  it("should handle unexpected runtime errors gracefully", async () => {
    const error = new Error("runtime");

    helper.filterResponse.mockImplementation(() => {
      throw error;
    });

    dao.deleteUserHierarchyDao.mockResolvedValue({});

    await expect(
      deleteUserHierarchyService([1], 1, Role.ADMIN)
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      "error in _deleteUserHierarchyServiceInternal",
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Error while deleting UserHierarchy",
      error
    );
  });
});