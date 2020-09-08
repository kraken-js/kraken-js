import { graphql } from '@kraken.js/cli/src/graphql';

module.exports = {
  name: 'graphql',
  alias: 'g',
  run: async toolbox => {
    const { config, print, filesystem } = toolbox;
    const spinner = print.spin('graphql');

    const kraken = config.loadConfig('kraken', filesystem.cwd());
    await graphql({ kraken }, { spinner, toolbox });
  }
};
