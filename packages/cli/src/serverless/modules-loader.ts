import { deepMerge } from '@kraken.js/core';
import * as fs from 'fs';
import * as path from 'path';

const generatedPath = '.generated';

const writeFileSync = (filename, content) => {
  const folders = filename.split(path.sep).slice(0, -1);
  if (folders.length) {
    folders.reduce((parent, child) => {
      if (!fs.existsSync(parent)) fs.mkdirSync(parent);

      const childPath = parent ? path.join(parent, child) : child;
      if (!fs.existsSync(childPath)) fs.mkdirSync(childPath);

      return childPath;
    });
  }
  fs.writeFileSync(filename, content, 'utf-8');
};

export const loadModules = ({ kraken }, { spinner }) => {
  if (!kraken || !kraken.serverless || kraken.serverless.length === 0) return;

  const serverless = kraken.serverless.map(module => {
    const moduleName = (typeof module === 'string') ? module : module.name;
    const moduleConfig = (typeof module === 'string') ? {} : module.config;

    spinner && (spinner.text = `🐙 Loading module ${moduleName}`);
    const moduleSls = require(moduleName);

    const isFunction = moduleSls instanceof Function;
    const { serverless } = isFunction ? moduleSls(moduleConfig) : moduleSls;

    if (serverless.functions) {
      Object.values(serverless.functions).forEach((fun: any) => {
        const fileName = fun.handler.substring(0, fun.handler.lastIndexOf('.'));
        const methodName = fun.handler.substring(fun.handler.lastIndexOf('.'));

        const generatedHandler = path.join(generatedPath, moduleName, fileName) + methodName;
        const generatedFileName = path.join(generatedPath, moduleName, fileName) + '.ts';
        writeFileSync(generatedFileName, `export { ${methodName} } from '${moduleName}'`);

        // overwrite the handler
        fun.handler = generatedHandler;
      });
    }

    return serverless;
  });

  return deepMerge(...serverless);
};
