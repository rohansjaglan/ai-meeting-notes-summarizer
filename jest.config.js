// Custom Jest configuration for tests folder structure
const { createJestConfig } = require('react-scripts/scripts/utils/createJestConfig');

// Create the base config
const baseConfig = createJestConfig(
  (resolve) => resolve,
  process.cwd(),
  false
);

module.exports = {
  ...baseConfig,
  
  // Override test locations to use tests folder
  testMatch: [
    '<rootDir>/tests/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/tests/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup/setupTests.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/main/main.js' // Exclude Electron main process from coverage
  ],
  
  coverageDirectory: 'tests/coverage'
};