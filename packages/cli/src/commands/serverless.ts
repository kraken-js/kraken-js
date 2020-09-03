import { serverless } from '@kraken.js/cli/src/serverless';

module.exports = {
  name: 'serverless',
  alias: 'sls',
  run: async (toolbox) => {
    const { parameters, system, filesystem, config, print } = toolbox;
    const spinner = print.spin('serverless');
    try {
      const cwd = process.cwd();
      const kraken = config.loadConfig('kraken', cwd);

      const slsConfig = serverless({ kraken }, { spinner, toolbox });
      filesystem.write('.kraken/serverless.json', slsConfig);

      spinner.text = `serverless ${parameters.string}...`;
      const stdout = await system.exec(`serverless ${parameters.string} --config .kraken/serverless.json`);
      spinner.stop();

      print.info(stdout);
    } catch (error) {
      spinner.stopAndPersist({ symbol: '🚨', text: 'Error running serverless command' });
      print.error(error.message);
      error.stdout && print.error(error.stdout);
      error.stderr && print.error(error.stderr);
    }
  }
};
