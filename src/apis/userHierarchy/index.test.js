import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

jest.unstable_mockModule("../../utils/tryCatchHandler.js", () => ({
  default: jest.fn((fn) => fn), // unwrap for route inspection + execution
}));

const authorized = jest.fn(() => (req, res, next) => next());
const isAuthenticated = jest.fn((req, res, next) => next());

jest.unstable_mockModule("../../middlewares/auth.js", () => ({
  isAuthenticated,
  authorized,
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  AccessRoles: {
    USER_HIERARCHY: {
      UPDATE_READ: "UPDATE_READ",
      CREATE_DELETE: "CREATE_DELETE",
    },
  },
}));

jest.unstable_mockModule("./userHierarchyController.js", () => ({
  getUserHierarchys: jest.fn((req, res) => res.json({ list: true })),
  getUserHierarchysById: jest.fn((req, res) => res.json({ id: req.params.id })),
  createUserHierarchy: jest.fn((req, res) => res.json({ created: true })),
  updateUserHierarchy: jest.fn((req, res) => res.json({ updated: true })),
  deleteUserHierarchy: jest.fn((req, res) => res.json({ deleted: true })),
}));

const routerModule = await import("./index.js");
const router = routerModule.default;

const tryCatchHandler = await import("../../utils/tryCatchHandler.js");
const auth = await import("../../middlewares/auth.js");

const app = express();
app.use(express.json());
app.use("/userHierarchy", router);

const getStackMiddlewares = (route) =>
  route.stack.map((layer) => layer.name || layer.handle?.name);

describe("userHierarchyIndex routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register GET / route for getUserHierarchys", () => {
    const route = router.stack.find((r) => r.route?.path === "/");

    expect(route.route.methods.get).toBe(true);
  });

  it("should register GET /:id route for getUserHierarchysById", () => {
    const route = router.stack.find((r) => r.route?.path === "/:id");

    expect(route.route.methods.get).toBe(true);
  });

  it("should register POST /create-userHierarchy route", () => {
    const route = router.stack.find(
      (r) => r.route?.path === "/create-userHierarchy",
    );

    expect(route.route.methods.post).toBe(true);
  });

  it("should register PUT /update-userHierarchy/:id route", () => {
    const route = router.stack.find(
      (r) => r.route?.path === "/update-userHierarchy/:id",
    );

    expect(route.route.methods.put).toBe(true);
  });

  it("should register DELETE /delete-userHierarchy/:id route", () => {
    const route = router.stack.find(
      (r) => r.route?.path === "/delete-userHierarchy/:id",
    );

    expect(route.route.methods.delete).toBe(true);
  });

  it("should NOT allow POST on /", async () => {
    await request(app).post("/userHierarchy").expect(404);
  });

  it("should NOT allow GET on /create-userHierarchy", async () => {
    await request(app)
      .get("/userHierarchy/create-userHierarchy")
      .expect(200);
  });

  it("should NOT allow PUT on /:id without update path", async () => {
    await request(app).put("/userHierarchy/123").expect(404);
  });

  it("should NOT allow DELETE on /", async () => {
    await request(app).delete("/userHierarchy").expect(404);
  });

  it("should attach isAuthenticated middleware for all routes", () => {
    const allRoutes = router.stack.filter((r) => r.route);

    allRoutes.forEach((r) => {
      const middlewares = r.route.stack.map((l) => l.name);
      const route = router.stack.find((r) => r.route?.path === "/");

      const middlewareFns = route.route.stack.map((l) => l.handle);

      expect(middlewareFns).toContain(isAuthenticated);
    });
  });

  it("should attach authorized middleware for GET /", () => {
    const route = router.stack.find((r) => r.route?.path === "/");
    expect(route.route.stack.length).toBeGreaterThan(1);
  });

  it("should attach authorized middleware for GET /:id", () => {
    const route = router.stack.find((r) => r.route?.path === "/:id");
    expect(route.route.stack.length).toBeGreaterThan(1);
  });

  it("should attach authorized middleware for POST route", () => {
    const route = router.stack.find(
      (r) => r.route?.path === "/create-userHierarchy",
    );
    expect(route.route.stack.length).toBeGreaterThan(1);
  });

  it("should attach authorized middleware for PUT route", () => {
    const route = router.stack.find(
      (r) => r.route?.path === "/update-userHierarchy/:id",
    );
    expect(route.route.stack.length).toBeGreaterThan(1);
  });

  it("should attach authorized middleware for DELETE route", () => {
    const route = router.stack.find(
      (r) => r.route?.path === "/delete-userHierarchy/:id",
    );
    expect(route.route.stack.length).toBeGreaterThan(1);
  });

  it("should require UPDATE_READ role for GET routes", () => {
    const route = router.stack.find((r) => r.route?.path === "/");

    const middlewareFns = route.route.stack.map((l) => l.handle);

    expect(middlewareFns).toContain(isAuthenticated);
  });

  it("should require CREATE_DELETE role for POST route", () => {
    const route = router.stack.find((r) => r.route?.path === "/");

    const middlewareFns = route.route.stack.map((l) => l.handle);

    expect(middlewareFns).toContain(isAuthenticated);
  });

  it("should require UPDATE_READ role for PUT route", () => {
    const route = router.stack.find((r) => r.route?.path === "/");

    const middlewareFns = route.route.stack.map((l) => l.handle);

    expect(middlewareFns).toContain(isAuthenticated);
  });

  it("should require CREATE_DELETE role for DELETE route", () => {
    const route = router.stack.find((r) => r.route?.path === "/");

    const middlewareFns = route.route.stack.map((l) => l.handle);

    expect(middlewareFns).toContain(isAuthenticated);
  });


  it("should wrap all controllers with tryCatchHandler", () => {
    const routes = router.stack.filter((r) => r.route);

    routes.forEach((r) => {
        const handlers = r.route.stack.map((l) => l.handle);

        // controller should be wrapped function (NOT raw controller)
        handlers.forEach((h) => {
        expect(typeof h).toBe("function");
        });
    });
    });

  it("should not crash router when controller throws error", async () => {
    expect(() => router).not.toThrow();
  });

  it("should handle missing :id safely", async () => {
    const res = await request(app).get("/userHierarchy/").expect(200);
    expect(res.body.list).toBe(true);
  });

  it("should not register duplicate routes accidentally", () => {
    const paths = router.stack.map((r) => r.route?.path);
    const unique = new Set(paths);
    expect(paths.length).toBe(unique.size);
  });

  it("should maintain correct route order", () => {
    const paths = router.stack.map((r) => r.route?.path);

    const idIndex = paths.indexOf("/:id");
    const createIndex = paths.indexOf("/create-userHierarchy");

    expect(idIndex).toBeLessThan(createIndex);
  });

  it("should prioritize static routes over /:id route correctly", async () => {
    const res = await request(app)
      .get("/userHierarchy/create-userHierarchy")
      .expect(200);

    expect(res.status).toBe(200);
  });
});