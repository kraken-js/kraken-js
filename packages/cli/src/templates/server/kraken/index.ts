export const graphqlSchema = {
  typeDefs: `
    type Query {
      hello: String! @aws_lambda(name: "hello", shouldParse: false)
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
      ping: (_, { channel }) => ({ channel, timestamp: Date.now() })
    }
  }
};
