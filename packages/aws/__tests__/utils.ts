import { AwsHandlerConfig, wsHandler } from '@kraken.js/aws';
import { ConnectionManager, SubscriptionManager } from '@kraken.js/core';
import { ApiGatewayManagementApi, DynamoDB } from 'aws-sdk';

export const ApiGatewayManagementApiMock = jest.fn<ApiGatewayManagementApi, any>(() => {
  return ({
    postToConnection: jest.fn(() => ({
      promise: () => Promise.resolve()
    })),
    deleteConnection: jest.fn(() => ({
      promise: () => Promise.resolve()
    }))
  } as any);
});

export const DocumentClientMock = () => new DynamoDB.DocumentClient({
  endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
  sslEnabled: false,
  region: 'local'
});

export const MockConnectionManager = jest.fn<ConnectionManager<any, any>, any>(() => {
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

export const MockSubscriptionManager = jest.fn<SubscriptionManager<any>, any>(() => ({
  publish: jest.fn().mockResolvedValue(null),
  subscribe: jest.fn().mockResolvedValue(null),
  unsubscribe: jest.fn().mockResolvedValue(null),
  unsubscribeAll: jest.fn().mockResolvedValue(null)
}));

export const mockWsHandler = ({ typeDefs, resolvers }: Pick<AwsHandlerConfig<any>, 'typeDefs' | 'resolvers'>) => {
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
