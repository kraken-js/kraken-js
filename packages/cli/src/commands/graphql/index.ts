import { graphqlModules } from './graphql-modules';

export const graphql = async ({ kraken }, { spinner, toolbox }) => {
  const { filesystem, patching } = toolbox;
  spinner && (spinner.text = 'generating graphql modules...');

  const { graphqlSchemaFile = 'src/schema.ts' } = kraken;
  filesystem.remove(graphqlSchemaFile);
  filesystem.write(graphqlSchemaFile, ''); // touch

  const { modulesStrings, importsStrings } = await graphqlModules({ kraken, graphqlSchemaFile }, { spinner });
  if (modulesStrings.some(m => m.includes('getStageConfig'))) {
    await patching.append(graphqlSchemaFile, `import { krakenJs, getStageConfig } from '@kraken.js/core';\n`);
  } else {
    await patching.append(graphqlSchemaFile, `import { krakenJs } from '@kraken.js/core';\n`);
  }
  await patching.append(graphqlSchemaFile, importsStrings.join('\n'));
  await patching.append(graphqlSchemaFile, `\n\n`);
  await patching.append(graphqlSchemaFile, `export const krakenSchema = krakenJs([\n\t`);
  await patching.append(graphqlSchemaFile, modulesStrings.join(',\n\t'));
  await patching.append(graphqlSchemaFile, `\n`);
  await patching.append(graphqlSchemaFile, `]);`);
  await patching.append(graphqlSchemaFile, `\n`);
  spinner.stopAndPersist({ symbol: '✅', text: 'schema file is ready' });
};
