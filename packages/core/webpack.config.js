module.exports = require('@kraken.js/webpack').forModule(__dirname, 'index.ts', {
  performance: { maxAssetSize: 36 * 1024 }
});
