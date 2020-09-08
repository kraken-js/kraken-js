import { IExecutableSchemaDefinition } from '@graphql-tools/schema';
// @ts-ignore
import * as typeDefs from './schema.graphql';

export const graphqlSchema: IExecutableSchemaDefinition = {
  typeDefs,
  resolvers: {
    Query: {
      systemInfo: () => ({})
    },
    SystemInfo: {
      region: () => process.env.AWS_REGION
    }
  }
};
