import * as importCwd from 'import-cwd';

const camelize = str => {
  const result = str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\W+/g, '');
  return result[0].toLowerCase() + result.slice(1);
};

export const graphqlModules = async ({ kraken, graphqlSchemaFile }, { spinner }): Promise<{ modulesStrings: string [], importsStrings: string[] }> => {
  if (!kraken || !kraken.graphql?.length) {
    spinner.stopAndPersist({ symbol: '🚨', text: 'No graphql modules found on kraken.config.js' });
    return { modulesStrings: [], importsStrings: [] };
  }

  const modules: string[] = [];
  const imports: string[] = [];

  for (let graphqlModule of kraken.graphql) {
    let graphqlModuleConfig = null;
    if (Array.isArray(graphqlModule)) {
      [graphqlModule, graphqlModuleConfig] = graphqlModule;
    }
    spinner && (spinner.text = `🐙 Loading Graphql module ${graphqlModule}`);

    // @kraken.js/aws, @kraken.js/aws:event,
    const [moduleName, exportName = 'graphqlSchema'] = graphqlModule.split(':');

    // @module/auth => graphqlSchema, @module/auth:schema => schema
    const exportedAs = camelize(exportName);

    // @module/auth:schema => import { xxx as moduleAuthSchema }
    const importAs = camelize(exportName === 'graphqlSchema' ? moduleName : [moduleName, exportName].join('-'));

    // import { schema as moduleAuthSchema } from '@module/auth';
    imports.push(`import { ${exportedAs} as ${importAs} } from '${moduleName}';`);

    // check if imported value is a function
    const importedFromCwd = importCwd.silent(moduleName) as any;
    const { [exportedAs]: resolvedModule } = importedFromCwd ? importedFromCwd : { [exportedAs]: importAs };

    // if function moduleAuthSchema(getStageConfig(...))
    const graphqlModuleConfigJson = graphqlModuleConfig ? JSON.stringify(graphqlModuleConfig) : '';
    const moduleConfigArgument = graphqlModuleConfigJson ? 'getStageConfig(' + graphqlModuleConfigJson + ')' : '';
    modules.push((typeof resolvedModule === 'function') ? `${importAs}(${moduleConfigArgument})` : importAs);
  }
  return { importsStrings: imports, modulesStrings: modules };
};
