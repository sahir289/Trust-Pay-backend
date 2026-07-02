import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/db.js", () => ({
  buildInsertQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/searchBuilder.js", () => ({
  buildSearchFilterObj: jest.fn(),
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  tableName: {
    USER_HIERARCHY: "UserHierarchy",
    MERCHANT: "Merchant",
  },
}));

jest.mock("./userHierarchyDao.js", () => ({
  getUserHierarchysDao: jest.fn(),
    createUserHierarchyDao: jest.fn(),
    updateUserHierarchyDao: jest.fn(),
    updateUserHierarchyVendor: jest.fn(),
    deleteUserHierarchyDao: jest.fn(),
    getUserHierarchysDashBoardReportDao: jest.fn(),
    getUserHierarchyVendor: jest.fn(),
    getAllHierarchyUserIds: jest.fn(),
}));

const db = await import("../../utils/db.js");
const { logger } = await import("../../utils/logger.js");
const searchBuilder = await import("../../utils/searchBuilder.js");
const dao = await import("./userHierarchyDao.js");

const {
  createUserHierarchyDao,
  updateUserHierarchyDao,
  updateUserHierarchyVendor,
  deleteUserHierarchyDao,
  getUserHierarchysDashBoardReportDao,
  getUserHierarchysDao,
  getUserHierarchyVendor,
  getAllHierarchyUserIds,
} = dao;

describe("createUserHierarchyDao", () => {
  beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

  test("should return first inserted row", async () => {
    db.buildInsertQuery.mockReturnValue(["SQL", ["p"]]);
    db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });

    const result = await createUserHierarchyDao({ a: 1 });

    expect(result).toEqual({ id: 1 });
  });

  test("should return undefined when no rows exist", async () => {
    db.buildInsertQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockResolvedValue({ rows: [] });

    const result = await createUserHierarchyDao({ a: 1 });

    expect(result).toBeUndefined();
  });

  test("should log and rethrow error when buildInsertQuery fails", async () => {
    db.buildInsertQuery.mockImplementation(() => {
      throw new Error("build error");
    });

    await expect(createUserHierarchyDao({})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });

  test("should log and rethrow error when executeQuery fails", async () => {
    db.buildInsertQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockRejectedValue(new Error("db error"));

    await expect(createUserHierarchyDao({})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("getUserHierarchysDashBoardReportDao - additional cases", () => {
  beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

  test("should return config list for valid filters", async () => {
    db.buildSelectQuery.mockReturnValue(["SQL", ["f"]]);
    db.executeQuery.mockResolvedValue({ rows: [{ config: 1 }] });

    const result = await getUserHierarchysDashBoardReportDao({});

    expect(result).toEqual([{ config: 1 }]);
  });

  test("should return empty array when no records found", async () => {
    db.buildSelectQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockResolvedValue({ rows: [] });

    const result = await getUserHierarchysDashBoardReportDao({});

    expect(result).toEqual([]);
  });

  test("should handle DB failure and throw", async () => {
    db.buildSelectQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockRejectedValue(new Error("fail"));

    await expect(getUserHierarchysDashBoardReportDao({})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("getUserHierarchysDao - additional cases", () => {
  beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

  test("should return empty array when no rows found", async () => {
    db.buildSelectQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockResolvedValue({ rows: [] });

    const result = await getUserHierarchysDao({});

    expect(result).toEqual([]);
  });

  test("should transform search using buildSearchFilterObj", async () => {
    searchBuilder.buildSearchFilterObj.mockReturnValue({ name: "LIKE" });

    db.buildSelectQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockResolvedValue({ rows: [] });

    await getUserHierarchysDao({ search: "abc" });

    expect(searchBuilder.buildSearchFilterObj).toHaveBeenCalled();
  });

  test("should handle DB error", async () => {
    db.buildSelectQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockRejectedValue(new Error("db fail"));

    await expect(getUserHierarchysDao({})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("updateUserHierarchyDao - additional cases", () => {
  beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

  test("should return undefined when no rows updated", async () => {
    db.buildUpdateQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockResolvedValue({ rows: [] });

    const result = await updateUserHierarchyDao(1, { a: 1 });

    expect(result).toBeUndefined();
  });

  test("should rethrow DB error", async () => {
    db.buildUpdateQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockRejectedValue(new Error("fail"));

    await expect(updateUserHierarchyDao(1, {})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("deleteUserHierarchyDao - additional cases", () => {
  beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

  test("should return undefined when no rows affected", async () => {
    db.buildUpdateQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockResolvedValue({ rows: [] });

    const result = await deleteUserHierarchyDao(1);

    expect(result).toBeUndefined();
  });

  test("should log and throw on DB failure", async () => {
    db.buildUpdateQuery.mockReturnValue(["SQL", []]);
    db.executeQuery.mockRejectedValue(new Error("fail"));

    await expect(deleteUserHierarchyDao(1)).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("getUserHierarchyVendor - additional cases", () => {
  beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

  test("should return empty object when no config exists", async () => {
    db.executeQuery.mockResolvedValue({ rows: [] });

    const result = await getUserHierarchyVendor(1);

    expect(result).toEqual({});
  });

  test("should return first config row", async () => {
    db.executeQuery.mockResolvedValue({ rows: [{ config: "x" }] });

    const result = await getUserHierarchyVendor(1);

    expect(result).toEqual("x");
  });

  test("should handle DB error", async () => {
    db.executeQuery.mockRejectedValue(new Error("fail"));

    await expect(getUserHierarchyVendor(1)).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("updateUserHierarchyVendor - additional cases", () => {
  beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

  test("should return undefined when no rows updated", async () => {
    db.executeQuery.mockResolvedValue({ rows: [] });

    const result = await updateUserHierarchyVendor(1, {});

    expect(result).toBeUndefined();
  });

  test("should log and throw error", async () => {
    db.executeQuery.mockRejectedValue(new Error("fail"));

    await expect(updateUserHierarchyVendor(1, {})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});
