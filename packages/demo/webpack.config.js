// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require('@kraken.js/webpack').forServerless(__dirname);

module.exports = {
  ...webpack
  // plugins: webpack.plugins.concat(new BundleAnalyzerPlugin())
};
