// @ts-ignore
import * as typeDefs from './resources/schema.graphql';
import { schemaDirectives } from './src/directives';
// @ts-ignore
export * as manifest from './package.json';

export const graphqlSchema = {
  typeDefs,
  schemaDirectives
};
