import { graphqlSchema, wsHandler } from '@kraken.js/aws';
import { krakenJs } from '@kraken.js/core';

const demoSchema = {
  typeDefs: `
    type Query {
      hello: String!
    }
    type Subscription {
        onPing(channel: String): Ping @sub(triggerNames: ["onPing#{channel}"])
    }
    type Mutation {
        ping(channel: String!): Ping @pub(triggerNames: ["onPing#{channel}"])
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

export const handler = wsHandler(krakenJs([
  graphqlSchema(),
  demoSchema
]));
