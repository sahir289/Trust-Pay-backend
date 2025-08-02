module.exports = {
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  transform: {
      '^.+\\.[t|j]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
      '/node_modules/(?!nanoid|chalk).+\\.js$',
  ],
  moduleFileExtensions: ['js', 'cjs', 'mjs', 'json'],
};