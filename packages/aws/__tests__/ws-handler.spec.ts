import { AwsHandlerConfig, wsHandler } from '@kraken.js/aws';
import { ConnectionManager, GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_DATA, SubscriptionManager } from '@kraken.js/core';
import gql from 'graphql-tag';

const MockConnectionManager = jest.fn<ConnectionManager<any, any>, any>(() => {
  const connections = {};
  return ({
    get: jest.fn(async (id) => {
      return connections[id];
    }),
    save: jest.fn(async (connection) => {
      connections[connection.connectionId] = connection;
    }),
    delete: jest.fn(async (connection) => {
      delete connections[connection.connectionId];
    }),
    send: jest.fn(async () => void 0)
  });
});

const MockSubscriptionManager = jest.fn<SubscriptionManager<any>, any>(() => ({
  publish: jest.fn().mockResolvedValue(null),
  subscribe: jest.fn().mockResolvedValue(null),
  unsubscribe: jest.fn().mockResolvedValue(null),
  unsubscribeAll: jest.fn().mockResolvedValue(null)
}));

const mockWsHandler = ({ typeDefs, resolvers }: Pick<AwsHandlerConfig<any>, 'typeDefs' | 'resolvers'>) => {
  const subscriptions = new MockSubscriptionManager();
  const connections = new MockConnectionManager();
  const handler = wsHandler({
    typeDefs,
    resolvers,
    subscriptions,
    connections
  });

  const state = { connectionId: null as any };
  const invoke = async ({ id, type, payload = {} }) => {
    return handler({
      requestContext: {
        routeKey: '$default',
        connectionId: state.connectionId,
        domainName: 'domain.fake',
        connectedAt: Date.now(),
        stage: 'test'
      },
      body: JSON.stringify({ id, type, payload })
    } as any, null as any, null as any);
  };

  const operation = async ({ id, type, query = '', variables = {} }) => {
    return invoke({ id, type, payload: { query, variables } });
  };

  const connect = async (connectionId, payload, protocol?) => {
    state.connectionId = connectionId;
    return handler({
      requestContext: {
        routeKey: '$connect',
        connectionId: state.connectionId
      },
      headers: {
        'Sec-WebSocket-Protocol': protocol
      }
    } as any, null as any, null as any);
  };

  const disconnect = async () => {
    return handler({
      requestContext: {
        routeKey: '$disconnect',
        connectionId: state.connectionId,
        domainName: 'domain.fake',
        stage: 'test'
      }
    } as any, null as any, null as any);
  };

  return { connections, subscriptions, handler, connect, invoke, operation, disconnect };
};

describe('aws handler', () => {
  it.each([
    ['c1', undefined, undefined],
    ['c2', null, null],
    ['c3', {}, ''],
    ['c4', { key: 'value' }, 'ws-graphql']
  ])('should reply to connect connection "%s" with params %s and protocol "%s"', async (connectionId, params, protocol) => {
    const { connect } = mockWsHandler({ typeDefs: gql('type Query { _: String }') });
    const actual = await connect(connectionId, params, protocol);
    expect(actual).toEqual({
      statusCode: 200,
      headers: { 'Sec-WebSocket-Protocol': protocol },
      body: ''
    });
  });

  it('should initialize connection, save it and reply with connection_ack', async () => {
    const { connect, invoke, connections } = mockWsHandler({
      typeDefs: gql('type Query { _: String }')
    });

    await connect('c1', null);
    await invoke({ id: 1, type: 'connection_init' });

    const connection = {
      apiGatewayUrl: 'https://domain.fake/test',
      connectedAt: expect.any(Number),
      connectionId: 'c1',
      context: {}
    };
    expect(connections.save).toHaveBeenCalledWith(connection);
    expect(connections.send).toHaveBeenCalledWith(connection, { type: GQL_CONNECTION_ACK });
  });

  it('should execute operation and send data to connection with response and complete response', async () => {
    const { connect, invoke, operation, connections } = mockWsHandler({
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: () => 'hello world' } }
    });

    await connect('c2', null);
    await invoke({ id: 1, type: 'connection_init' });
    await operation({ id: 2, type: 'start', query: 'query { hello }' });

    expect(connections.send).toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c2'
    }), {
      id: 2,
      type: GQL_DATA,
      payload: { data: { hello: 'hello world' } }
    });
    expect(connections.send).toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c2'
    }), {
      id: 2,
      type: GQL_COMPLETE
    });
  });

  it('should remove subscription on connection terminate', async () => {
    const { connect, invoke, disconnect, operation, connections, subscriptions } = mockWsHandler({
      typeDefs: gql('type Query { _: String }')
    });

    await connect('c0', null);
    await invoke({ id: 1, type: 'connection_init' });
    await disconnect();

    expect(connections.delete).toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c0'
    }));
    expect(subscriptions.unsubscribeAll).toHaveBeenCalledWith('c0');
  });

  it('should remove subscription on operation stop', async () => {
    const { connect, invoke, operation, connections, subscriptions } = mockWsHandler({
      typeDefs: gql('type Query { _: String } type Subscription { onMessage: String }'),
      resolvers: { Subscription: { onMessage: () => 'hello world' } }
    });

    await connect('c3', null);
    await invoke({ id: 1, type: 'connection_init' });
    await operation({ id: 2, type: 'start', query: 'subscription { onMessage }' });
    await operation({ id: 2, type: 'stop' });

    expect(connections.send).not.toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c3'
    }), expect.objectContaining({
      id: 2,
      type: GQL_DATA
    }));

    expect(subscriptions.unsubscribe).toHaveBeenCalledWith('c3', 2);
    expect(connections.send).toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c3'
    }), {
      id: 2,
      type: GQL_COMPLETE
    });
  });

  it('should remove connection and all subscriptions on connection_terminate', async () => {
    const { connect, invoke, operation, connections, subscriptions } = mockWsHandler({
      typeDefs: gql('type Query { _: String }')
    });

    await connect('c4', null);
    await invoke({ id: 1, type: 'connection_init' });
    await operation({ id: 2, type: 'connection_terminate' });

    expect(connections.delete).toHaveBeenCalledWith({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c4'
    });
    expect(subscriptions.unsubscribeAll).toHaveBeenCalledWith('c4');
  });
});
