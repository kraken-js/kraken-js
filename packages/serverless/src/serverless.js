const path = require('path');
const minimist = require('minimist');
const yaml = require('yaml-boost');

module.exports = () => {
  const params = minimist(process.argv.slice(2));
  params.home = path.relative(__dirname, process.cwd());
  params.now = new Date().toISOString().replace(/:/g, '-').split('.')[0];

  const output = yaml.load(path.join(__dirname, '..', 'resources/serverless.commons.yml'), params);

  // merge environment configs
  const stage = output.provider.stage;
  output.provider.environment = {
    ...output.custom.environment.default,
    ...output.custom.environment[stage]
  };
  delete output.custom.environment;

  return output;
};
