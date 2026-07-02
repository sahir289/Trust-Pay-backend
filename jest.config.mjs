export default {
  testEnvironment: "node",

  testMatch: [
    "**/?(*.)+(test|spec).js"
  ],

  transform: {},

  extensionsToTreatAsEsm: [],

  moduleFileExtensions: ["js", "json"],

  transformIgnorePatterns: [
    "/node_modules/"
  ],

  forceExit: true,
  detectOpenHandles: true,
};