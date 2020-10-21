module.exports = require('@kraken.js/webpack').forModule(__dirname, 'index.ts', {
  performance: { maxAssetSize: 90 * 1024 }
});
