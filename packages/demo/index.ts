export const demoSchema = {
  typeDefs: `
    type Query {
      hello: String!
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
    Query: {
      hello: () => process.env.hello
    },
    Mutation: {
      ping: (_, { channel }) => ({ channel, timestamp: Date.now() })
    }
  }
};
