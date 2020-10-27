const webpackForServerless = require('@kraken.js/webpack').forServerless(__dirname);
module.exports = { ...webpackForServerless, devtool: false };
