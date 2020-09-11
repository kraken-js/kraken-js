import { graphqlSchema as krakenJsAws, wsHandler } from '@kraken.js/aws';
import { mergeGraphqlSchemas } from '@kraken.js/core';

const demoSchema = {
  typeDefs: `
    type Query {
      hello: String!
    }
    type Subscription {
        onPing(channel: String): String @sub(triggerName: "onPing#{channel}")
    }
    type Mutation {
        ping(channel: String!): Ping @pub(triggerName: "onPing#{channel}")
    }
    type Ping {
        channel: String!
        timestamp: Float!
    }`,
  resolvers: {
    Query: {
      hello: () => process.env.hello
    },
    Mutation: {
      ping: (_, { channel }) => ({ channel, timestamp: Date.now() })
    }
  }
};

export const handler = wsHandler(mergeGraphqlSchemas([
  krakenJsAws,
  demoSchema
]));
