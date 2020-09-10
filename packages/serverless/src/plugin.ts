'use strict';
import { cosmiconfigSync } from 'cosmiconfig';
import path from 'path';
import Serverless from 'serverless';
import Plugin from 'serverless/classes/Plugin';

const generatedPath = '.kraken';

export default class KrakenJs implements Plugin {
  public static pluginName = '@kraken.js/serverless';
  public hooks: Plugin.Hooks = {};
  protected plugins: string[] = [];

  constructor(protected serverless: Serverless, protected config: Serverless.Config) {
    this.loadServerlessModules();
    this.plugins.forEach(plugin => {
      this.serverless.pluginManager.addPlugin(require(plugin));
    });
    this.serverless.service.validate();
  }

  loadServerlessModules() {
    const modules = this.getKrakenConfig();
    if (modules.length > 0) {
      for (const module of modules) {
        const { serverless, manifest } = this.loadModule(module);
        this.wrapFunctions({ serverless, manifest });

        const plugins = serverless.plugins;
        delete serverless.plugins;

        this.serverless.service.update(serverless);
        if (plugins) this.plugins.push(...plugins);
      }
    }
    (this.serverless.service as any).plugins.push(...this.plugins);

    const stage = (this.config as any).stage || (this.config as any).s || 'dev';
    const environment = {
      ...(this.serverless.service.provider as any).environment,
      ...this.serverless.service.custom.environment?.default,
      ...this.serverless.service.custom.environment?.[stage]
    };

    delete this.serverless.service.custom.environment;
    this.serverless.service.update({ provider: { environment } });
  }

  private loadModule(module) {
    const moduleName = (typeof module === 'string') ? module : module.name;
    const moduleConfig = (typeof module === 'string') ? {} : module.config;

    if (!this.isPrintCommand()) {
      this.serverless.cli.log(`🐙 loading module ${moduleName}`);
    }

    const [moduleRequire, exportName = 'serverless'] = moduleName.split(':');
    const moduleSls = require(moduleRequire);

    const isFunction = moduleSls instanceof Function;
    const {
      [exportName]: serverless,
      manifest = { name: moduleName }
    } = isFunction ? moduleSls(moduleConfig) : moduleSls;
    return { serverless, manifest };
  }

  private isPrintCommand() {
    return (this.serverless as any).processedInput.commands.includes('print');
  }

  private wrapFunctions({ serverless, manifest: { name: moduleName } }) {
    if (serverless.functions) {
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

