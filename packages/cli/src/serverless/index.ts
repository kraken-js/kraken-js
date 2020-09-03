import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { deepMerge } from '@kraken.js/core/src/helpers';
import { loadModules } from './modules-loader';
import serverlessConfig from './serverless-config';

const loadLocal = ({ toolbox }) => {
  const cwd = process.cwd();
  const localServerlessFile = `${cwd}/serverless.yml`;
  if (fs.existsSync(localServerlessFile)) {
    return yaml.safeLoad(fs.readFileSync(localServerlessFile, 'utf8'));
  }
  toolbox?.print.warning('⚠️ Local serverless config not found');
};

export const serverless = ({ kraken }, { spinner, toolbox }) => {
  const serverlessLocal = loadLocal({ toolbox });
  const loadedModules = loadModules({ kraken }, { spinner });
  const output = deepMerge(serverlessConfig, serverlessLocal, loadedModules);

  // merge environment configs
  const stage = output.provider.stage;
  output.provider.environment = {
    ...output.custom.environment.default,
    ...output.custom.environment[stage]
  };
  delete output.custom.environment;

  return output;
};
