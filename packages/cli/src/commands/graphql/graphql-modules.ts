const camelize = str => {
  const result = str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\W+/g, '');
  return result[0].toLowerCase() + result.slice(1);
};

export const graphqlModules = async ({ kraken, graphqlSchemaFile }, { spinner, toolbox }) => {
  if (!kraken || !kraken.graphql?.length) {
    spinner.stopAndPersist({ symbol: '🚨', text: 'No graphql modules found on kraken.config.js' });
    return [];
  }

  const { patching } = toolbox;
  const modules: string[] = [];
  for (const graphqlModule of kraken.graphql) {
    spinner && (spinner.text = `🐙 Loading Graphql module ${graphqlModule}`);

    const [moduleName, exportName = 'graphqlSchema'] = graphqlModule.split(':');
    const importAs = camelize(moduleName);
    const exportedAs = camelize(exportName);
    await patching.append(graphqlSchemaFile, `import { ${exportedAs} as ${importAs} } from '${moduleName}';\n`);
    modules.push(importAs);
  }
  return modules;
};
