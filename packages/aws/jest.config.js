const jest = require('@kraken.js/jest').jest();
module.exports = {
  ...jest,
  setupFiles: ['./jest.setup.js']
};

