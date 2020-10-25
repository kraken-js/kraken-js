export const graphqlSchema = {
  typeDefs: `
    type Query {
      hello: String! @lambda(name: "hello", shouldParse: false)
    }
    type Subscription {
        onPing(channel: String): Ping @sub(triggerName: "onPing#{channel}")
    }
    type Mutation {
        ping(channel: String!): Ping @pub(triggerNames: ["onPing#{channel}"])
    }
    type Ping {
        channel: String!
        timestamp: Float!
    }`,
  resolvers: {
    Mutation: {
      ping: async (_, { channel }, { $events }: Kraken.Context) => {
        const response = { channel, timestamp: Date.now() };
        await $events.source('Ping:Invoked').type('Ping').event(response).send();
        return response;
      }
    }
  }
};
