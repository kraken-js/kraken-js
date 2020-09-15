const path = require('path');

require('dotenv').config({ path: '__tests__/.env.test' });

module.exports = () => ({
  preset: 'ts-jest',
  testEnvironment: 'node',
  restoreMocks: true,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['index.ts', 'src/**/*.{ts,js}'],
  modulePaths: ['node_modules', '.'],
  setupFiles: [path.join(__dirname, 'jest.setup.js')],
  globals: { 'ts-jest': { isolatedModules: true } },
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  transform: {
    '\\.(gql|graphql)$': 'jest-transform-graphql',
    '\\.yml$': 'jest-yaml-transform'
  }
});
