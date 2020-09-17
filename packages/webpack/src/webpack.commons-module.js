const nodeExternals = require('webpack-node-externals');
const webpackCommons = require('./webpack.commons');

module.exports = (dirname, entry) => ({
  ...webpackCommons(dirname, entry),
  externals: [
    nodeExternals({
      additionalModuleDirs: ['../../node_modules']
    })
  ]
});
