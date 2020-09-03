import { graphqlModules } from './graphql-modules';

export const graphql = async ({ kraken }, { spinner, toolbox }) => {
  const { filesystem, patching } = toolbox;
  spinner && (spinner.text = 'generating graphql modules...');

  const graphqlFile = '.kraken/graphql.ts';
  filesystem.remove(graphqlFile);
  filesystem.write(graphqlFile, `// generated at ${new Date()} by kraken cli\n\n`);

  await patching.append(graphqlFile, `import { mergeGraphqlSchemas } from '@kraken.js/core';\n`);
  await patching.append(graphqlFile, `\n`);
  const modules = await graphqlModules({ kraken, graphqlFile }, { spinner, toolbox });
  await patching.append(graphqlFile, `\n`);
  await patching.append(graphqlFile, `export default mergeGraphqlSchemas([\n\t${modules.join(',\n\t')}\n]);\n`);
  spinner.stopAndPersist({ symbol: '✅', text: 'finished loading graphql modules' });
};
