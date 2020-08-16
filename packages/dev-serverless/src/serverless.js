const { loader } = require('./loader');
const { deepMerge } = require('./helpers');
const minimist = require('minimist');
const path = require('path');
const yaml = require('yaml-boost');

const now = () => new Date().toISOString().replace(/:/g, '-').split('.')[0];

const serverless = () => {
  const home = path.relative(__dirname, process.cwd());
  const config = require(path.join(home, 'kraken.config.js'));

  const params = minimist(process.argv.slice(2));
  params.home = home;
  params.now = now();

  const commons = yaml.load(path.join(__dirname, '..', 'resources/serverless.commons.yml'), params);
  const modules = loader({ config });
  const output = deepMerge(commons, modules);

  // merge environment configs
  const stage = output.provider.stage;
  output.provider.environment = {
    ...output.custom.environment.default,
    ...output.custom.environment[stage]
  };
  delete output.custom.environment;

  return output;
};

module.exports = { serverless };
