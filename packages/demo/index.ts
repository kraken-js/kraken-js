export const demoSchema = {
  typeDefs: `
    type Query {
      hello: String! @aws_lambda(name: "hello", shouldParse: false)
      message: Message! @aws_lambda(name: "message")
    }
    type Subscription {
        onPing(channel: String): Ping @sub(triggerName: "onPing#{channel}")
    }
    type Mutation {
        ping(channel: String!): Ping @pub(triggerNames: ["onPing#{channel}"])
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
