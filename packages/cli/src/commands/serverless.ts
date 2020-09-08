import { serverless } from '@kraken.js/cli/src/serverless';

module.exports = {
  name: 'serverless',
  alias: 'sls',
  run: async (toolbox) => {
    const { parameters, system, filesystem, config, print } = toolbox;
    const spinner = print.spin('serverless');
    const args = parameters.argv.slice(3).join(' ');
    try {
      const cwd = filesystem.cwd();
      const kraken = config.loadConfig('kraken', cwd);
      console.debug(kraken);

      const slsConfig = serverless({ kraken }, { spinner, toolbox });
      console.debug(slsConfig);
      filesystem.write('.kraken/serverless.json', slsConfig);

      spinner.text = `serverless ${args}...`;
      const stdout = await system.exec(`serverless ${args} --config .kraken/serverless.json`);
      spinner.stop();

      print.info(stdout);
    } catch (error) {
      spinner.stopAndPersist({ symbol: '🚨', text: `Error running serverless command "serverless ${args}"` });
      print.error(error.message);
      error.stdout && print.error(error.stdout);
      error.stderr && print.error(error.stderr);
    }
  }
};
