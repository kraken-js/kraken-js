import { graphqlSchema as krakenJsAws, wsHandler } from '@kraken.js/aws';
import { mergeGraphqlSchemas } from '@kraken.js/core';

const demoSchema = {
  typeDefs: `type Query {
    hello: String
  }`,
  resolvers: {
    Query: {
      hello: () => process.env.hello
    }
  }
};

export const handler = wsHandler(mergeGraphqlSchemas([
  krakenJsAws,
  demoSchema
]));
