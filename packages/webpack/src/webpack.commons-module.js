const nodeExternals = require('webpack-node-externals');
const webpackCommons = require('./webpack.commons');

module.exports = (dirname, entry, custom = {}) => ({
  ...webpackCommons(dirname, entry),
  ...custom,
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
    ...custom.optimization
  },
  performance: {
    maxAssetSize: 100000,
    hints: 'error',
    ...custom.performance
  },
  externals: [
    nodeExternals({
      additionalModuleDirs: ['../../node_modules']
    })
  ]
});
