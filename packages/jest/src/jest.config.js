const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: '__tests__/.env.test' });

module.exports = (dirname) => {
  const packageJson = require(dirname + '/package.json');
  const setupFile = path.join(dirname, 'jest.setup.js');
  const setupFiles = fs.existsSync(setupFile) ? [setupFile] : undefined;
  return ({
    preset: 'ts-jest',
    testEnvironment: 'node',
    restoreMocks: true,
    clearMocks: true,
    collectCoverage: true,
    collectCoverageFrom: ['index.ts', 'src/**/*.{ts,js}'],
    modulePaths: ['node_modules', '.'],
    setupFiles,
    globals: { 'ts-jest': { isolatedModules: true } },
    testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
    transform: {
      '\\.(gql|graphql)$': 'jest-transform-graphql',
      '\\.yml$': 'jest-yaml-transform'
    },
    moduleNameMapper: {
      [packageJson.name]: '<rootDir>'
    }
  });
};
