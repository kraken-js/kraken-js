import { deepMerge } from '@kraken.js/core/src/helpers';
import * as yaml from 'js-yaml';
import { serverlessModules } from './serverless-modules';

const loadLocal = ({ toolbox }) => {
  const { print, filesystem } = toolbox;
  const localServerlessFile = `${filesystem.cwd()}/serverless.yml`;
  if (filesystem.exists(localServerlessFile)) {
    return yaml.safeLoad(filesystem.read(localServerlessFile));
  }
  print.warning('⚠️ Local serverless config not found');
};

export const serverless = ({ kraken }, { spinner, toolbox }) => {
  const serverlessLocal = loadLocal({ toolbox });
  console.debug(serverlessLocal);
  const loadedModules = serverlessModules({ kraken }, { spinner });
  console.debug(loadedModules);
  const output = deepMerge(serverlessLocal, loadedModules);

  // merge environment configs
  const stage = output.provider.stage;
  output.provider.environment = {
    ...output.custom.environment.default,
    ...output.custom.environment[stage]
  };
  delete output.custom.environment;

  return output;
};
