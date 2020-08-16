const { deepMerge } = require('./helpers');
const path = require('path');
const fs = require('fs');

const generatedPath = '.generated';

const writeFileSync = (filename, content, charset) => {
  const folders = filename.split(path.sep).slice(0, -1);
  if (folders.length) {
    folders.reduce((parent, child) => {
      if (!fs.existsSync(parent)) fs.mkdirSync(parent);

      const childPath = parent ? path.join(parent, child) : child;
      if (!fs.existsSync(childPath)) fs.mkdirSync(childPath);

      return childPath;
    });
  }
  fs.writeFileSync(filename, content, charset);
};

const loader = ({ config }) => {
  if (!config.modules) return;
  const modules = config.modules.filter(module => module.serverless);

  const serverless = modules.map(module => {
    const moduleName = module.manifest.name;
    console.info(`🐙 loading module ${moduleName}`);

    const isFunction = module.serverless instanceof Function;
    const serverless = isFunction ? module.serverless(config) : module.serverless;

    if (serverless.functions) {
      Object.values(serverless.functions).forEach(fun => {
        const handlerFileName = fun.handler.substring(0, fun.handler.lastIndexOf('.'));
        const handlerName = fun.handler.substring(fun.handler.lastIndexOf('.'));

        const generatedHandler = path.join(generatedPath, moduleName, handlerFileName) + handlerName;
        const generatedFileName = path.join(generatedPath, moduleName, handlerFileName) + '.ts';
        writeFileSync(generatedFileName, `export * from '${moduleName}/${handlerFileName}'`);

        // overwrite the handler
        fun.handler = generatedHandler;
      });
    }

    return serverless;
  });

  return deepMerge(...serverless);
};

module.exports = { loader };
