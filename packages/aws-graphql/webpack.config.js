const path = require('path');
module.exports = require('@kraken.js/dev-webpack').webpack(__dirname, path.join(__dirname, 'index.ts'));
