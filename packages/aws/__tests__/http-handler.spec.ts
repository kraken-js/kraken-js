import { krakenJs, KrakenSchema } from '@kraken.js/core';
import { httpHandler } from '..';

const testSchema: KrakenSchema = {
  typeDefs: `
    type Query { hello(name: String): String }
    type Mutation { sendMessage(channel: String, message: String): Message }
    type Message { channel: String message: String }`,
  resolvers: {
    Query: { hello: (_, { name }, context) => `hello ${name} (${context.authorization})` },
    Mutation: { sendMessage: (_, args) => args }
  },
  onConnect(context) {
    return {
      ...context.connectionParams
    };
  }
};

describe('AWS Http Handler', () => {
  it('should execute graphql', async () => {
    const handler = httpHandler(krakenJs(testSchema));
    const response = await handler({
      requestContext: {
        connectionId: '1308123'
      },
      headers: {
        authorization: 'Bearer 102938092843'
      },
      body: JSON.stringify({
        query: 'query helloQuery($name: String) { hello(name: $name)  }',
        operationName: 'helloQuery',
        variables: {
          name: 'world'
        }
      })
    } as any, null, null);

    expect(response).toEqual({
      body: JSON.stringify({ data: { hello: 'hello world (Bearer 102938092843)' } }),
      statusCode: 200
    });
  });
});
