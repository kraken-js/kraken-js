export const graphqlSchema = {
  typeDefs: `
    type Query {
      hello: String! @lambda(name: "hello", shouldParse: false)
      message: Message! @lambda(name: "message")
    }
    type Subscription {
        onPing(channel: String): Ping @sub(triggerName: "onPing#{channel}")
    }
    type Mutation {
        ping(channel: String!): Ping @event @pub(triggerNames: ["onPing#{channel}"])
    }
    type Message {
      message: String!
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
