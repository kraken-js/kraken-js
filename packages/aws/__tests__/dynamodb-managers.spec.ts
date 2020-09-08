import { dynamoDbConnectionManager, dynamoDbSubscriptionManager } from '@kraken.js/aws';
import { GQL_DATA } from '@kraken.js/core';
import 'jest-dynalite/withDb';
import { ApiGatewayManagementApiMock, DocumentClientMock } from './utils';

const awsStuff = () => {
  const apiGateway = new ApiGatewayManagementApiMock();
  const dynamoDb = DocumentClientMock();
  return { apiGateway, dynamoDb };
};

const connectionManager = () => {
  const { apiGateway, dynamoDb } = awsStuff();
  const connections = dynamoDbConnectionManager({
    apiGateway: () => apiGateway,
    dynamoDb
  });
  return { dynamoDb, apiGateway, connections };
};

const subscriptionsManager = () => {
  const { apiGateway, dynamoDb } = awsStuff();
  const subscriptions = dynamoDbSubscriptionManager({
    apiGateway: () => apiGateway,
    dynamoDb
  });
  return { dynamoDb, apiGateway, subscriptions };
};

describe('DynamoDB Connection Manager', () => {
  it('should persist connection on DynamoDB on save', async () => {
    const { dynamoDb, connections } = connectionManager();

    await connections.save({ connectionId: 'c1', context: { v: 1 } });

    const { Item } = await dynamoDb.get({
      TableName: 'WsSubscriptions-test',
      Key: { connectionId: 'c1', subscriptionId: '$connection' }
    }).promise();
    expect(Item).toEqual({
      connectionId: 'c1',
      subscriptionId: '$connection',
      context: { v: 1 }
    });
  });

  it.each([[0, 1], [1, 2]])('should fail to get connection with %s retry', async (retries, times) => {
    const { connections } = connectionManager();
    await expect(connections.get('c2', retries)).rejects.toThrowError('Connection c2 not found');
  });

  it('should get connection successfully', async () => {
    const { connections } = connectionManager();
    await connections.save({ connectionId: 'c3' });
    const connection = await connections.get('c3');
    expect(connection).toEqual({
      connectionId: 'c3',
      subscriptionId: '$connection'
    });
  });
});

describe('DynamoDB Subscription Manager', () => {
  it.each([
    ['onMessage#{xxx}', 'onMessage#', {}, {}],
    ['onMessage#{chatId}', 'onMessage#chat:1', { chatId: 'chat:1' }, { $chatId: 'chat:1' }],
    [
      'onMessage#{chatId}#{userId}',
      'onMessage#chat:1#user:1',
      { chatId: 'chat:1', userId: 'user:1' },
      { $chatId: 'chat:1', $userId: 'user:1' }
    ]
  ])('should save subscription %s to database with interpolated triggerName %s and variables %s',
    async (triggerName, interpolatedTriggerName, params, vars) => {
      const { subscriptions, dynamoDb } = subscriptionsManager();
      const metadata = {
        apiGatewayUrl: 'https://domain.fake/test',
        connectionId: 'connection-id',
        subscriptionId: 'subscription-id'
      };
      await subscriptions.subscribe(triggerName, {
        ...metadata,
        ...params
      });

      const { Item } = await dynamoDb.get({
        TableName: 'WsSubscriptions-test',
        Key: { connectionId: 'connection-id', subscriptionId: 'subscription-id' }
      }).promise();

      expect(Item).toEqual({
        ...metadata,
        ...vars,
        triggerName: interpolatedTriggerName
      });
    });

  it('should publish to subscriptions listening to triggerName', async () => {
    const { subscriptions, apiGateway } = subscriptionsManager();
    const con = (conn, sub) => ({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: conn,
      subscriptionId: sub
    });

    await subscriptions.subscribe('onMessage#{chatId}', { ...con('c1', 's1'), chatId: 'chat:1' });
    await subscriptions.subscribe('onMessage#{chatId}', { ...con('c1', 's2'), chatId: 'chat:2' });
    await subscriptions.subscribe('onMessage#{chatId}', { ...con('c2', 's1'), chatId: 'chat:1' });
    await subscriptions.subscribe('onMessage#{chatId}', { ...con('c2', 's2'), chatId: 'chat:2' });

    const payload = { chatId: 'chat:1', message: 'hello' };
    await subscriptions.publish('onMessage#{chatId}', payload);

    expect(apiGateway.postToConnection).toHaveBeenCalledTimes(2);
    expect(apiGateway.postToConnection).toHaveBeenCalledWith({
      ConnectionId: 'c1',
      Data: JSON.stringify({
        id: 's1',
        type: GQL_DATA,
        payload: { data: { onMessage: payload } }
      })
    });
    expect(apiGateway.postToConnection).toHaveBeenCalledWith({
      ConnectionId: 'c2',
      Data: JSON.stringify({
        id: 's1',
        type: GQL_DATA,
        payload: { data: { onMessage: payload } }
      })
    });
  });
});
