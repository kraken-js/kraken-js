import { GraphQLModule } from '@graphql-modules/core';
import { wsHandler } from '@kraken.js/aws-graphql';
import { postToConnection } from '@kraken.js/aws-graphql/src/ws-handler/connection-manager-aws-helpers';
import gql from 'graphql-tag';

jest.mock('@kraken.js/aws-graphql/src/ws-handler/connection-manager-aws-helpers', jest.fn(() => {
  const database = {};
  return ({
    deleteApiGatewayConnection: jest.fn(),
    deleteConnection: jest.fn(),
    deleteSubscription: jest.fn(),
    getApiGatewayUrl: jest.fn(() => 'aws://api-gateway-url'),
    getConnection: jest.fn(id => {
      const value = JSON.parse(database[id]);
      return Promise.resolve(value);
    }),
    postToConnection: jest.fn(),
    putConnection: jest.fn(data => {
      const value = JSON.stringify(data);
      database[data.connectionId] = value;
      return Promise.resolve(value);
    })
  });
}));

const simpleModule = new GraphQLModule({
  typeDefs: gql`
      type Query {
          fromContext: String
          fromInjector: String
      }
  `,
  providers: [
    { provide: 'fromInjector', useValue: 'I COME FROM THE INJECTOR' }
  ],
  context() {
    return { fromContext: 'I COME FROM FROM THE CONTEXT' };
  },
  resolvers: {
    Query: {
      fromContext: (_, __, { fromContext }) => {
        return fromContext;
      },
      fromInjector: (_, __, { injector }) => {
        return injector.get('fromInjector');
      }
    }
  }
});

const invoker = (handler, { requestContext }) => {
  return async (body) => {
    const event = {
      requestContext,
      body: JSON.stringify(body)
    } as any;
    await handler(event, null, null);
  };
};

describe('WS Handler', () => {
  test('should initialize and return value from context', async () => {
    const handler = invoker(wsHandler({
      imports: [
        simpleModule.forRoot({})
      ]
    }), { requestContext: { connectionId: 1 } });

    await handler({ type: 'connection_init', payload: {} });
    expect(postToConnection).toHaveBeenCalledWith(expect.anything(), {
      type: 'connection_ack'
    });

    await handler({ id: '1', type: 'start', payload: { query: 'query { fromContext }' } });
    expect(postToConnection).toHaveBeenCalledWith(expect.anything(), {
      id: '1',
      payload: { data: { fromContext: 'I COME FROM FROM THE CONTEXT' } },
      type: 'data'
    });
    expect(postToConnection).toHaveBeenCalledWith(expect.anything(), {
      id: '1',
      type: 'complete'
    });
  });

  test('should initialize and return value from injector', async () => {
    const handler = invoker(wsHandler({
      imports: [
        simpleModule.forRoot({})
      ]
    }), { requestContext: { connectionId: 2 } });

    await handler({ type: 'connection_init', payload: {} });
    expect(postToConnection).toHaveBeenCalledWith(expect.anything(), {
      type: 'connection_ack'
    });

    await handler({ id: '2', type: 'start', payload: { query: 'query { fromInjector }' } });
    expect(postToConnection).toHaveBeenCalledWith(expect.anything(), {
      id: '2',
      payload: { data: { fromInjector: 'I COME FROM THE INJECTOR' } },
      type: 'data'
    });
    expect(postToConnection).toHaveBeenCalledWith(expect.anything(), {
      id: '2',
      type: 'complete'
    });
  });
});
