const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const isProduction = process.env.ENV === 'production';

module.exports = (dirname, entry) => ({
  context: dirname,
  node: {
    __dirname: false,
    __filename: false
  },
  entry: typeof entry === 'string' ? path.join(dirname, entry) : entry,
  devtool: isProduction ? 'source-map' : 'cheap-source-map',
  mode: isProduction ? 'production' : 'development',

  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.json', '.yml', '.graphql', '.html'],
    mainFields: ['module', 'main'],
    symlinks: true,
    cacheWithContext: false
  },

  target: 'node',
  externals: [
    { 'aws-sdk': 'commonjs aws-sdk' },
    { 'graphql': 'commonjs graphql' }
  ],

  module: {
    rules: [
      {
        test: /\.(graphql|gql)$/,
        exclude: /node_modules/,
        loader: 'graphql-tag/loader'
      },
      {
        test: /\.(yaml|yml)$/,
        exclude: /node_modules/,
        use: 'js-yaml-loader'
      },
      {
        test: /\.(html|txt)$/,
        exclude: /node_modules/,
        use: 'raw-loader'
      },
      {
        test: /\.(tsx?)$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly: true,
          onlyCompileBundledFiles: true,
          allowTsInNodeModules: true
        }
      }
    ]
  },

  optimization: {
    removeAvailableModules: isProduction,
    minimize: isProduction,
    usedExports: isProduction,
    sideEffects: isProduction
  },

  output: {
    libraryTarget: 'commonjs',
    path: path.join(dirname, 'dist'),
    pathinfo: false
  }
});
