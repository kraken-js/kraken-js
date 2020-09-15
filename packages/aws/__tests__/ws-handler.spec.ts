import { graphqlSchema, wsHandler } from '@kraken.js/aws';
import {
  GQL_COMPLETE,
  GQL_CONNECTION_ACK,
  GQL_CONNECTION_INIT,
  GQL_CONNECTION_TERMINATE,
  GQL_DATA,
  GQL_START,
  GQL_STOP,
  krakenIt,
  KrakenSchema
} from '@kraken.js/core';
import { ApiGatewayManagementApi, DynamoDB } from 'aws-sdk';
import 'jest-dynalite/withDb';

const apiGatewayMock = {
  postToConnection: jest.fn(() => ({
    promise: () => Promise.resolve()
  })),
  deleteConnection: jest.fn(() => ({
    promise: () => Promise.resolve()
  }))
} as unknown as ApiGatewayManagementApi;

const testSchema: KrakenSchema = {
  typeDefs: `
    type Query { hello(name: String): String }
    type Mutation { sendMessage(channel: String, message: String): Message @pub(triggerName: "onMessage#{channel}") }
    type Subscription { onMessage(channel: String): Message @sub(triggerName: "onMessage#{channel}") }
    type Message {
      channel: String
      message: String
    }`,
  resolvers: {
    Query: { hello: (_, { name }) => `hello ${name}` },
    Mutation: { sendMessage: (_, args) => args }
  }
};

const setupTest = () => {
  const dynamoDb = new DynamoDB.DocumentClient({
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: 'local'
  });

  const kraken = krakenIt([
    graphqlSchema({
      dynamoDb,
      apiGateway: apiGatewayMock,
      connections: { waitForConnectionTimeout: 5 }
    }),
    testSchema
  ]);

  const handler = wsHandler(kraken);
  const connectionId = Math.random().toString(32);
  const execute = async (body) => {
    await handler({
      requestContext: {
        connectionId: connectionId,
        domainName: 'domain.fake',
        stage: process.env.STAGE
      },
      body: JSON.stringify(body)
    } as any, null, null);
  };

  return {
    execute,
    connectionId,
    kraken,
    dynamoDb
  };
};

describe('AWS Websocket Handler', () => {
  describe('should successfully execute pub/sub', () => {
    const numOfSubscriptions = 77;
    const { execute, connectionId, dynamoDb } = setupTest();

    beforeEach(async () => {
      await execute({ type: GQL_CONNECTION_INIT });
      for (let s = 0; s < numOfSubscriptions; s++) {
        await execute({
          id: 's' + s,
          type: GQL_START,
          payload: { query: 'subscription { onMessage(channel: "general") { __typename channel message } }' }
        });
      }
      await execute({
        id: '2',
        type: GQL_START,
        payload: { query: 'mutation { sendMessage(channel: "general", message: "hi") { __typename channel message } }' }
      });
      await execute({
        id: '2',
        type: GQL_STOP
      });
      await execute({
        type: GQL_CONNECTION_TERMINATE
      });
    });

    it('respond to initialize the connection', () => {
      expect(apiGatewayMock.postToConnection).toHaveBeenCalledWith({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          type: GQL_CONNECTION_ACK
        })
      });
    });

    it('broadcast to all subscriptions', () => {
      for (let s = 0; s < numOfSubscriptions; s++) {
        expect(apiGatewayMock.postToConnection).toHaveBeenCalledWith({
          ConnectionId: connectionId,
          Data: JSON.stringify({
            id: 's' + s,
            type: GQL_DATA,
            payload: { data: { onMessage: { __typename: 'Message', channel: 'general', message: 'hi' } } }
          })
        });
      }
    });

    it('respond to the mutation', () => {
      expect(apiGatewayMock.postToConnection).toHaveBeenCalledWith({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          id: '2',
          type: GQL_DATA,
          payload: { data: { sendMessage: { __typename: 'Message', channel: 'general', message: 'hi' } } }
        })
      });
      expect(apiGatewayMock.postToConnection).toHaveBeenCalledWith({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          id: '2',
          type: GQL_COMPLETE
        })
      });
    });

    it('delete the connection from api gateway', () => {
      expect(apiGatewayMock.deleteConnection).toHaveBeenCalledWith({
        ConnectionId: connectionId
      });
    });

    it('cleanup the connection and subscriptions from database', async () => {
      const { Count } = await dynamoDb.scan({
        TableName: 'WsSubscriptions-test',
        Select: 'COUNT'
      }).promise();
      expect(Count).toEqual(0);
    });
  });
});
