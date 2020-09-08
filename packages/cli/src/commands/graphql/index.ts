import { graphqlModules } from './graphql-modules';

export const graphql = async ({ kraken }, { spinner, toolbox }) => {
  const { filesystem, patching } = toolbox;
  spinner && (spinner.text = 'generating graphql modules...');

  const { graphqlSchemaFile = 'src/schema.ts' } = kraken;
  filesystem.remove(graphqlSchemaFile);
  filesystem.write(graphqlSchemaFile, ''); // touch

  await patching.append(graphqlSchemaFile, `import { mergeGraphqlSchemas } from '@kraken.js/core';\n`);
  const modules = await graphqlModules({ kraken, graphqlSchemaFile }, { spinner, toolbox });
  await patching.append(graphqlSchemaFile, `\n`);
  await patching.append(graphqlSchemaFile, `export const graphqlSchema = mergeGraphqlSchemas([\n\t${modules.join(',\n\t')}\n]);\n`);
  spinner.stopAndPersist({ symbol: '✅', text: 'finished loading graphql modules' });
};
