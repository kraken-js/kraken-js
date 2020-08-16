const serverless = require('serverless-webpack')
const webpackCommons = require('./webpack.commons')
const webpack = require('webpack')

module.exports = (dirname) => ({
  ...webpackCommons(dirname, serverless.lib.entries),
  externals: [
    { 'aws-sdk': 'commonjs aws-sdk' },
    { 'bufferutil': 'commonjs bufferutil' },
    { 'utf-8-validate': 'commonjs utf-8-validate' }
  ],
  plugins: [
    new webpack.DefinePlugin({ 'global.GENTLY': false })
  ]
})
