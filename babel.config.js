module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        electron: '27.0.0'
      },
      useBuiltIns: 'entry',
      corejs: 3
    }],
    ['@babel/preset-react', {
      runtime: 'automatic'
    }]
  ],
  plugins: [
    // Add any additional Babel plugins here
  ],
  env: {
    development: {
      plugins: [
        // Development-specific plugins
      ]
    },
    production: {
      plugins: [
        // Production-specific plugins
      ]
    }
  }
};