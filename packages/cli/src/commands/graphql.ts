import { graphql } from '@kraken.js/cli/src/graphql';

module.exports = {
  name: 'graphql',
  alias: 'g',
  run: async toolbox => {
    const { config, print } = toolbox;
    const spinner = print.spin('graphql');

    const kraken = config.loadConfig('kraken', process.cwd());
    await graphql({ kraken }, { spinner, toolbox });
  }
};
