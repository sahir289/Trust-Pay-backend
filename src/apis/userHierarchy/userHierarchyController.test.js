import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/responseHandlers.js", () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule("./userHierarchyService.js", () => ({
  createUserHierarchyService: jest.fn(),
  updateUserHierarchyService: jest.fn(),
  getUserHierarchyService: jest.fn(),
  deleteUserHierarchyService: jest.fn(),
}));

jest.unstable_mockModule("../../schemas/userHierarchySchema.js", () => ({
  VALIDATE_UPDATE_USER_HIERARCHY_STATUS: { validate: jest.fn() },
  VALIDATE_DELETE_USER_HIERARCHY: { validate: jest.fn() },
  VALIDATE_USER_HIERARCHY_SCHEMA: { validate: jest.fn() },
  VALIDATE_USER_HIERARCHY_BY_ID: { validate: jest.fn() },
}));

jest.unstable_mockModule("../../utils/appErrors.js", () => ({
  ValidationError: class ValidationError extends Error {},
}));

jest.unstable_mockModule("../../utils/redishashkey.js", () => ({
  generateCacheKey: jest.fn(() => "mock-cache-key"),
}));
const redishashkey = await import("../../utils/redishashkey.js");

jest.unstable_mockModule("../../utils/controllerCache.js", () => ({
  normalizeQueryForCache: jest.fn(() => ({})),
  readJsonCache: jest.fn(),
  writeJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));

jest.unstable_mockModule("../../config/config.js", () => ({
  default: {
    controllerCacheTtls: {
      userHierarchy: {
        list: 100,
        byId: 100,
      },
    },
  },
}));

const controller = await import("./userHierarchyController.js");
const service = await import("./userHierarchyService.js");
const response = await import("../../utils/responseHandlers.js");
const schema = await import("../../schemas/userHierarchySchema.js");
const cache = await import("../../utils/controllerCache.js");
const config = await import("../../config/config.js");

const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  user: { company_id: 1, user_id: 10, role: "ADMIN" },
  ...overrides,
});

const mockRes = () => ({});

describe("userHierarchyController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });


  describe("createUserHierarchy", () => {
    it("should create hierarchy successfully", async () => {
      schema.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({
        error: null,
      });

      service.createUserHierarchyService.mockResolvedValue({});
      cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

      response.sendSuccess.mockReturnValue("success");

      const req = mockReq({ body: { name: "test" } });
      const res = mockRes();

      const result = await controller.createUserHierarchy(req, res);

      expect(service.createUserHierarchyService).toHaveBeenCalled();
      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      expect(response.sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "UserHierarchy created successfully",
      );
      expect(result).toBe("success");
    });

    it("should throw validation error on invalid body", async () => {
      schema.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({
        error: new Error("Invalid"),
      });

      const req = mockReq();
      const res = mockRes();

      await expect(
        controller.createUserHierarchy(req, res),
      ).rejects.toThrow();
    });
  });
  
  describe("createUserHierarchy - new", () => {
    it("should create user hierarchy successfully and return success response", async () => {
      schema.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({
        error: null,
      });

      service.createUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("success");

      const req = mockReq({ body: { name: "test" } });
      const res = mockRes();

      const result = await controller.createUserHierarchy(req, res);

      expect(service.createUserHierarchyService).toHaveBeenCalled();
      expect(response.sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "UserHierarchy created successfully",
      );
      expect(result).toBe("success");
    });

    it("should throw ValidationError when schema validation fails", async () => {
      schema.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({
        error: new Error("invalid"),
      });

      const req = mockReq();
      const res = mockRes();

      await expect(controller.createUserHierarchy(req, res)).rejects.toThrow();
    });

    it("should call service with correct payload (company_id, created_by, updated_by)", async () => {
      schema.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({
        error: null,
      });

      service.createUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq({ body: { a: 1 } });
      const res = mockRes();

      await controller.createUserHierarchy(req, res);

      const payload = service.createUserHierarchyService.mock.calls[0][0];

      expect(payload.company_id).toBe(1);
      expect(payload.created_by).toBe(10);
      expect(payload.updated_by).toBe(10);
    });

    it("should invalidate user hierarchy cache after successful creation", async () => {
      schema.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({
        error: null,
      });

      service.createUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq();
      const res = mockRes();

      await controller.createUserHierarchy(req, res);

      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
    });

    it("should not call service when validation fails", async () => {
      schema.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({
        error: new Error("fail"),
      });

      const req = mockReq();
      const res = mockRes();

      await expect(controller.createUserHierarchy(req, res)).rejects.toThrow();
      expect(service.createUserHierarchyService).not.toHaveBeenCalled();
    });

    it("should return empty object in success response", async () => {
      schema.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({
        error: null,
      });

      service.createUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq();
      const res = mockRes();

      const result = await controller.createUserHierarchy(req, res);

      expect(response.sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        expect.any(String),
      );
      expect(result).toBe("ok");
    });
  });

  describe("getUserHierarchys", () => {
    it("should return cached response when available", async () => {
      cache.readJsonCache.mockResolvedValue({ cached: true });
      cache.shouldServeCachedResponse.mockReturnValue(true);

      response.sendSuccess.mockReturnValue("cached-response");

      const req = mockReq({ query: { page: 1, limit: 10 } });
      const res = mockRes();

      const result = await controller.getUserHierarchys(req, res);

      expect(cache.readJsonCache).toHaveBeenCalled();
      expect(response.sendSuccess).toHaveBeenCalledWith(
        res,
        { cached: true },
        "UserHierarchy fetched successfully",
      );
      expect(result).toBe("cached-response");
    });

    it("should fetch from service when cache miss", async () => {
      cache.readJsonCache.mockResolvedValue(null);
      cache.shouldServeCachedResponse.mockReturnValue(false);

      service.getUserHierarchyService.mockResolvedValue({ data: [] });

      response.sendSuccess.mockReturnValue("fresh-response");

      const req = mockReq({ query: { page: 1, limit: 10 } });
      const res = mockRes();

      const result = await controller.getUserHierarchys(req, res);

      expect(service.getUserHierarchyService).toHaveBeenCalled();
      expect(cache.writeJsonCache).toHaveBeenCalled();
      expect(response.sendSuccess).toHaveBeenCalled();
      expect(result).toBe("fresh-response");
    });
  });

  describe("getUserHierarchys - new", () => {
    it("should return cached response when cache hit", async () => {
      cache.readJsonCache.mockResolvedValue({ cached: true });
      cache.shouldServeCachedResponse.mockReturnValue(true);
      response.sendSuccess.mockReturnValue("cached");

      const req = mockReq({ query: { page: 1, limit: 10 } });
      const res = mockRes();

      const result = await controller.getUserHierarchys(req, res);

      expect(response.sendSuccess).toHaveBeenCalledWith(
        res,
        { cached: true },
        "UserHierarchy fetched successfully",
      );
      expect(result).toBe("cached");
    });

    it("should fetch data from service when cache miss", async () => {
      cache.readJsonCache.mockResolvedValue(null);
      cache.shouldServeCachedResponse.mockReturnValue(false);

      service.getUserHierarchyService.mockResolvedValue({ data: [] });
      response.sendSuccess.mockReturnValue("fresh");

      const req = mockReq({ query: { page: 1, limit: 10 } });
      const res = mockRes();

      const result = await controller.getUserHierarchys(req, res);

      expect(service.getUserHierarchyService).toHaveBeenCalled();
      expect(cache.writeJsonCache).toHaveBeenCalled();
      expect(result).toBe("fresh");
    });

    it("should generate correct cache key using company_id, role, page, limit, query", async () => {
      cache.readJsonCache.mockResolvedValue(null);
      cache.shouldServeCachedResponse.mockReturnValue(false);
      service.getUserHierarchyService.mockResolvedValue({});

      const req = mockReq({ query: { page: 2, limit: 20, search: "abc" } });
      const res = mockRes();

      await controller.getUserHierarchys(req, res);

      expect(redishashkey.generateCacheKey).toHaveBeenCalledWith(
        expect.objectContaining({
            company_id: 1,
            role: "ADMIN",
        }),
        "user-hierarchy-list"
        );
    });

    it("should call service with correct parameters", async () => {
      cache.readJsonCache.mockResolvedValue(null);
      cache.shouldServeCachedResponse.mockReturnValue(false);
      service.getUserHierarchyService.mockResolvedValue({});

      const req = mockReq({ query: { page: 1, limit: 10 } });
      const res = mockRes();

      await controller.getUserHierarchys(req, res);

      expect(service.getUserHierarchyService).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 1,
        }),
        "ADMIN",
        1,
        10,
      );
    });

    it("should handle empty query params correctly", async () => {
      cache.readJsonCache.mockResolvedValue(null);
      cache.shouldServeCachedResponse.mockReturnValue(false);
      service.getUserHierarchyService.mockResolvedValue({});

      const req = mockReq({ query: {} });
      const res = mockRes();

      await controller.getUserHierarchys(req, res);

      expect(service.getUserHierarchyService).toHaveBeenCalled();
    });
  });

  describe("getUserHierarchysById", () => {
    it("should return cached by-id response", async () => {
    schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
    });

    cache.readJsonCache.mockResolvedValue({ id: 1 });
    cache.shouldServeCachedResponse.mockReturnValue(true);

    response.sendSuccess.mockReturnValue("cached");

    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();

    const result = await controller.getUserHierarchysById(req, res);

    expect(response.sendSuccess).toHaveBeenCalled();
    expect(result).toBe("cached");
    });

    it("should fetch by id from service when cache miss", async () => {
    schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
    });

    cache.readJsonCache.mockResolvedValue(null);
    cache.shouldServeCachedResponse.mockReturnValue(false);

    service.getUserHierarchyService.mockResolvedValue({ id: 1 });

    response.sendSuccess.mockReturnValue("fresh");

    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();

    const result = await controller.getUserHierarchysById(req, res);

    expect(service.getUserHierarchyService).toHaveBeenCalled();
    expect(cache.writeJsonCache).toHaveBeenCalled();
    expect(result).toBe("fresh");
    });
  });

  describe("getUserHierarchysById - new", () => {
    it("should throw ValidationError when params validation fails", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: new Error("bad"),
      });

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await expect(
        controller.getUserHierarchysById(req, res),
      ).rejects.toThrow();
    });

    it("should return cached response when cache hit", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });

      cache.readJsonCache.mockResolvedValue({ id: 1 });
      cache.shouldServeCachedResponse.mockReturnValue(true);
      response.sendSuccess.mockReturnValue("cached");

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      const result = await controller.getUserHierarchysById(req, res);

      expect(result).toBe("cached");
    });

    it("should fetch data from service when cache miss", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });

      cache.readJsonCache.mockResolvedValue(null);
      cache.shouldServeCachedResponse.mockReturnValue(false);

      service.getUserHierarchyService.mockResolvedValue({ id: 1 });
      response.sendSuccess.mockReturnValue("fresh");

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      const result = await controller.getUserHierarchysById(req, res);

      expect(service.getUserHierarchyService).toHaveBeenCalled();
      expect(cache.writeJsonCache).toHaveBeenCalled();
      expect(result).toBe("fresh");
    });

    it("should call service with correct id and company_id", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });

      cache.readJsonCache.mockResolvedValue(null);
      cache.shouldServeCachedResponse.mockReturnValue(false);

      service.getUserHierarchyService.mockResolvedValue({});

      const req = mockReq({ params: { id: 99 } });
      const res = mockRes();

      await controller.getUserHierarchysById(req, res);

      const args = service.getUserHierarchyService.mock.calls[0];
      expect(args[0]).toEqual({ id: 99, company_id: 1 });
    });
  });

  describe("updateUserHierarchy", () => {
    it("should update successfully", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });
      schema.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({
        error: null,
      });

      service.updateUserHierarchyService.mockResolvedValue({});
      cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

      response.sendSuccess.mockReturnValue("updated");

      const req = mockReq({
        params: { id: 1 },
        body: { status: "ACTIVE" },
      });

      const res = mockRes();

      const result = await controller.updateUserHierarchy(req, res);

      expect(service.updateUserHierarchyService).toHaveBeenCalled();
      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      expect(result).toBe("updated");
    });

    it("should throw validation error", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: new Error("bad id"),
      });

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await expect(
        controller.updateUserHierarchy(req, res),
      ).rejects.toThrow();
    });
  });

  describe("updateUserHierarchy - new", () => {
    it("should throw ValidationError when params validation fails", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: new Error("bad"),
      });

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await expect(controller.updateUserHierarchy(req, res)).rejects.toThrow();
    });

    it("should throw ValidationError when body validation fails", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });

      schema.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({
        error: new Error("bad"),
      });

      const req = mockReq({ params: { id: 1 }, body: {} });
      const res = mockRes();

      await expect(controller.updateUserHierarchy(req, res)).rejects.toThrow();
    });

    it("should call service with correct ids and payload", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });
      schema.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({
        error: null,
      });

      service.updateUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq({ params: { id: 1 }, body: { status: "A" } });
      const res = mockRes();

      await controller.updateUserHierarchy(req, res);

      expect(service.updateUserHierarchyService).toHaveBeenCalled();
    });

    it("should add updated_by to payload before service call", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });
      schema.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({
        error: null,
      });

      service.updateUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq({ params: { id: 1 }, body: { status: "A" } });
      const res = mockRes();

      await controller.updateUserHierarchy(req, res);

      const payload =
        service.updateUserHierarchyService.mock.calls[0][1];

      expect(payload.updated_by).toBe(10);
    });

    it("should invalidate cache after update", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });
      schema.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({
        error: null,
      });

      service.updateUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq({ params: { id: 1 }, body: {} });
      const res = mockRes();

      await controller.updateUserHierarchy(req, res);

      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
    });

    it("should return success response with empty object", async () => {
      schema.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({
        error: null,
      });
      schema.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({
        error: null,
      });

      service.updateUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq({ params: { id: 1 }, body: {} });
      const res = mockRes();

      const result = await controller.updateUserHierarchy(req, res);

      expect(result).toBe("ok");
    });
  });

  describe("deleteUserHierarchy", () => {
    it("should delete successfully", async () => {
      schema.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({
        error: null,
      });

      service.deleteUserHierarchyService.mockResolvedValue({});
      cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

      response.sendSuccess.mockReturnValue("deleted");

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      const result = await controller.deleteUserHierarchy(req, res);

      expect(service.deleteUserHierarchyService).toHaveBeenCalled();
      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      expect(result).toBe("deleted");
    });

    it("should throw validation error", async () => {
      schema.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({
        error: new Error("invalid"),
      });

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await expect(
        controller.deleteUserHierarchy(req, res),
      ).rejects.toThrow();
    });
  });
  describe("deleteUserHierarchy - new", () => {
    it("should throw ValidationError when params validation fails", async () => {
      schema.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({
        error: new Error("bad"),
      });

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await expect(controller.deleteUserHierarchy(req, res)).rejects.toThrow();
    });

    it("should call service with correct ids and updated_by", async () => {
      schema.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({
        error: null,
      });

      service.deleteUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await controller.deleteUserHierarchy(req, res);

      expect(service.deleteUserHierarchyService).toHaveBeenCalled();
    });

    it("should invalidate cache after delete", async () => {
      schema.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({
        error: null,
      });

      service.deleteUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await controller.deleteUserHierarchy(req, res);

      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
    });

    it("should return success response with empty object", async () => {
      schema.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({
        error: null,
      });

      service.deleteUserHierarchyService.mockResolvedValue({});
      response.sendSuccess.mockReturnValue("ok");

      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      const result = await controller.deleteUserHierarchy(req, res);

      expect(result).toBe("ok");
    });
  });

  describe("edge cases", () => {
    it("should not call service when cache hit", async () => {
      cache.readJsonCache.mockResolvedValue({ data: 1 });
      cache.shouldServeCachedResponse.mockReturnValue(true);

      const req = mockReq({ query: { page: 1 } });
      const res = mockRes();

      await controller.getUserHierarchys(req, res);

      expect(service.getUserHierarchyService).not.toHaveBeenCalled();
    });

    it("should handle undefined query safely", async () => {
      cache.readJsonCache.mockResolvedValue(null);
      cache.shouldServeCachedResponse.mockReturnValue(false);
      service.getUserHierarchyService.mockResolvedValue({});

      const req = mockReq({ query: { page: "undefined" } });
      const res = mockRes();

      await controller.getUserHierarchys(req, res);

      expect(service.getUserHierarchyService).toHaveBeenCalled();
    });
  });
});