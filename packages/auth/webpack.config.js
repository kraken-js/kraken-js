module.exports = require('@kraken.js/webpack').forModule(__dirname, 'index.ts', {
  performance: { maxAssetSize: 20 * 1024 }
});
