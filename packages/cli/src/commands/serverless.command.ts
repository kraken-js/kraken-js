import { serverless } from './serverless';

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

      const slsConfig = serverless({ kraken }, { spinner, toolbox });
      filesystem.write('.kraken/serverless.json', slsConfig);

      spinner.stopAndPersist(`serverless ${args}...`);
      await system.spawn(`serverless ${args} --config .kraken/serverless.json`, {
        shell: true,
        stdio: 'inherit'
      });
    } catch (error) {
      spinner.stopAndPersist({ symbol: '🚨', text: `Error running serverless command "serverless ${args}"` });
      print.error(error.message);
      error.stdout && print.error(error.stdout);
      error.stderr && print.error(error.stderr);
    }
  }
};
