import { httpHandler } from '@kraken.js/aws';
import { krakenJs, KrakenSchema } from '@kraken.js/core';

const testSchema: KrakenSchema = {
  typeDefs: `
    type Query { hello(name: String): String }
    type Mutation { sendMessage(channel: String, message: String): Message }
    type Message { channel: String message: String }`,
  resolvers: {
    Query: { hello: (_, { name }, context: any) => `hello ${name} (${context.authorization})` },
    Mutation: { sendMessage: (_, args) => args }
  },
  onConnect(context: any) {
    return {
      ...context.connectionParams
    };
  }
};

describe('AWS Http Handler', () => {
  it('should reply to OPTIONS request', async () => {
    const handler = httpHandler(krakenJs(testSchema), { cors: true });
    const response = await handler({ httpMethod: 'OPTIONS', requestContext: {} } as any, null, null);
    expect(response).toEqual({
      statusCode: 200,
      body: '',
      headers: {
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'private, max-age=600'
      }
    });
  });

  it('should reply with custom headers to OPTIONS request', async () => {
    const handler = httpHandler(krakenJs(testSchema), {
      cors: {
        headers: 'hs',
        methods: 'ms',
        origin: 'or'
      }
    });
    const response = await handler({ httpMethod: 'OPTIONS', requestContext: {} } as any, null, null);
    expect(response).toEqual({
      statusCode: 200,
      body: '',
      headers: {
        'Access-Control-Allow-Headers': 'hs',
        'Access-Control-Allow-Methods': 'ms',
        'Access-Control-Allow-Origin': 'or',
        'Access-Control-Allow-Credentials': true,
        'Cache-Control': 'private, max-age=600'
      }
    });
  });

  it('should reply to GET request', async () => {
    const callback = jest.fn();
    const handler = httpHandler(krakenJs(testSchema));
    await handler({ httpMethod: 'GET', requestContext: {} } as any, null, callback);
    expect(callback).toHaveBeenCalledWith(null, {
      statusCode: 200,
      body: expect.stringContaining('<html>'),
      headers: {
        'Content-Type': 'text/html'
      }
    });
  });

  it('should reply to warmup request', async () => {
    const handler = httpHandler(krakenJs(testSchema));
    const response = await handler({} as any, null, null);
    expect(response).toEqual({ statusCode: 200, body: '' });
  });

  it('should execute graphql', async () => {
    const handler = httpHandler(krakenJs(testSchema), { cors: {} });
    const response = await handler({
      requestContext: {
        connectionId: '1308123',
        identity: {
          sourceIp: '0.0.0.0'
        }
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
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Origin': '*'
      }
    });
  });

  it('should fail with 400 on execution failure', async () => {
    const handler = httpHandler(krakenJs(testSchema), { cors: {} });
    const response = await handler({
      requestContext: {
        connectionId: '1241234',
        identity: {
          sourceIp: '0.0.0.0'
        }
      },
      body: JSON.stringify({
        query: 'XXXXX',
        variables: {
          name: 'world'
        }
      })
    } as any, null, null);

    expect(response).toEqual({
      body: expect.any(String),
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Origin': '*'
      }
    });
  });
});
