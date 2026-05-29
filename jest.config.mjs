export default {
  testEnvironment: "node",
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)',
    '**/?(*.)+(spec|test).mjs'
  ],
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { presets: ["@babel/preset-env"] }],
    "^.+\\.mjs$": ["babel-jest", { presets: ["@babel/preset-env"] }],
    "^.+\\.js$": ["babel-jest", { presets: ["@babel/preset-env"] }],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(chalk|ansi-styles|supports-color|kleur|strip-ansi|ansi-regex|otplib|@scure/base|qrcode|@noble/hashes|@noble/curves|@noble/ed25519|@noble/secp256k1|nanoid)/)"
  ],
  moduleNameMapper: {},
  forceExit: true,
  // detectOpenHandles: true,
};