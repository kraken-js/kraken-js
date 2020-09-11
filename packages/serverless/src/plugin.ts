'use strict';
import { cosmiconfigSync } from 'cosmiconfig';
import path from 'path';
import Serverless from 'serverless';
import Plugin from 'serverless/classes/Plugin';

const generatedPath = '.kraken';

const camelize = str => {
  const result = str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\W+/g, '');
  return result[0].toLowerCase() + result.slice(1);
};

export default class KrakenJs implements Plugin {
  public static pluginName = '@kraken.js/serverless';
  public hooks: Plugin.Hooks = {};
  protected plugins = new Set<string>();

  constructor(protected serverless: Serverless, protected config: Serverless.Config) {
    this.loadServerlessModules();
    this.plugins.forEach(plugin => {
      this.serverless.pluginManager.addPlugin(require(plugin));
    });
    this.serverless.service.validate();
  }

  loadServerlessModules() {
    this.loadModules(this.getKrakenConfig());
    (this.serverless.service as any).plugins.push(...this.plugins.values());

    const stage = (this.config as any).stage || (this.config as any).s || 'dev';
    const environment = {
      ...(this.serverless.service.provider as any).environment,
      ...this.serverless.service.custom.environment?.default,
      ...this.serverless.service.custom.environment?.[stage]
    };

    delete this.serverless.service.custom.environment;
    this.serverless.service.update({ provider: { environment } });
  }

  private loadModules(modules: any[] = []) {
    if (modules.length > 0) {
      for (const module of modules) {
        const { serverless = {}, manifest } = this.loadModule(module);
        this.importFunctions({ serverless, manifest });
        this.serverless.service.update(serverless);

        if (serverless.plugins) {
          serverless.plugins.forEach(plugin =>
            this.plugins.add(plugin)
          );
        }
      }
    }
  }

  private loadModule(module) {
    const moduleName = (typeof module === 'string') ? module : module.name;
    const moduleConfig = (typeof module === 'string') ? {} : module.config;

    if (!this.isPrintCommand()) {
      this.serverless.cli.log(`🐙 loading module ${moduleName}`);
    }

    const [moduleRequire, exportName = 'serverless'] = moduleName.split(':');
    const moduleSls = require(moduleRequire);

    const {
      [camelize(exportName)]: importedServerless,
      manifest = { name: moduleName }
    } = moduleSls instanceof Function ? moduleSls(moduleConfig) : moduleSls;

    const serverless = importedServerless instanceof Function
      ? importedServerless(moduleConfig)
      : importedServerless;

    // recursive modules loading
    this.loadModules(serverless.custom?.kraken);

    return { serverless, manifest };
  }

  private isPrintCommand() {
    return (this.serverless as any).processedInput.commands.includes('print');
  }

  private importFunctions({ serverless, manifest: { name: moduleName } }) {
    if (serverless?.functions) {
      Object.values(serverless.functions).forEach((fun: any) => {
        const handlerFileName = fun.handler.substring(0, fun.handler.lastIndexOf('.'));
        const handlerName = fun.handler.substring(fun.handler.lastIndexOf('.'));

        const generatedHandler = path.join(generatedPath, moduleName, handlerFileName) + handlerName;
        const generatedFileName = path.join(generatedPath, moduleName, handlerFileName) + '.ts';
        this.serverless.utils.writeFileSync(generatedFileName, `export * from '${moduleName}/${handlerFileName}'`);

        // overwrite the handler
        fun.handler = generatedHandler;
      });
    }
  }

  private getKrakenConfig() {
    const result: any[] = [];

    // serverless.yml -> custom.kraken
    const serverlessConfig = this.serverless.service.custom.kraken;
    if (serverlessConfig) result.push(...serverlessConfig);

    // kraken.config.js
    const krakenConfig = cosmiconfigSync('kraken').search();
    if (krakenConfig) {
      const { config: { serverless = [] } } = krakenConfig;
      result.push(...serverless);
    }

    return result;
  }
};

