import { wsHandler } from '@kraken.js/aws';
// @ts-ignore
import * as typeDefs from './schema.graphql';

export const handler = wsHandler({
  typeDefs,
  resolvers: {
    Query: {
      hello: () => 'olá mundo!'
    }
  }
});
