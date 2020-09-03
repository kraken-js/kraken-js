const camelize = str => {
  const result = str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\W+/g, '');
  return result[0].toLowerCase() + result.slice(1);
};

export const graphqlModules = async ({ kraken, graphqlFile }, { spinner, toolbox }) => {
  if (!kraken || !kraken.graphql?.length) {
    spinner.stopAndPersist({ symbol: '🚨', text: 'No graphql modules found on kraken.config.js' });
    return [];
  }

  const { patching } = toolbox;
  const modules: string[] = [];
  for (const module of kraken.graphql) {
    spinner && (spinner.text = `🐙 Loading Graphql module ${module}`);

    const moduleName = camelize(module);
    await patching.append(graphqlFile, `import { graphqlSchema as ${moduleName} } from '${module}';\n`);
    modules.push(moduleName);
  }
  return modules;
};
