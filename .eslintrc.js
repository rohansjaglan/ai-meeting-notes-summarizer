module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'react-app',
    'react-app/jest'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: [
    'react'
  ],
  rules: {
    // React specific rules
    'react/prop-types': 'warn',
    'react/no-unused-state': 'warn',
    'react/no-array-index-key': 'warn',
    
    // General JavaScript rules
    'no-console': 'warn',
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'prefer-const': 'warn',
    'no-var': 'error',
    
    // Code style
    'indent': ['warn', 2],
    'quotes': ['warn', 'single'],
    'semi': ['warn', 'always'],
    'comma-dangle': ['warn', 'never'],
    
    // Electron specific
    'no-restricted-globals': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  overrides: [
    {
      files: ['src/main/**/*.js'],
      env: {
        browser: false,
        node: true
      },
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly'
      },
      rules: {
        'no-console': 'off'
      }
    }
  ]
};