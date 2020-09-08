import { dynamoDbConnectionManager, dynamoDbSubscriptionManager } from '@kraken.js/aws';
import { GQL_DATA } from '@kraken.js/core';
import 'jest-dynalite/withDb';
import { ApiGatewayManagementApiMock, DocumentClientMock } from './utils';

const TableName = 'WsSubscriptions-test';
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
      TableName,
      Key: { connectionId: 'c1', subscriptionId: '$connection' }
    }).promise();
    expect(Item).toEqual({
      connectionId: 'c1',
      subscriptionId: '$connection',
      context: { v: 1 },
      ttl: expect.any(Number)
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
      subscriptionId: '$connection',
      ttl: expect.any(Number)
    });
  });
});

describe('DynamoDB Subscription Manager', () => {
  const connection = (conn, sub) => ({
    apiGatewayUrl: 'https://domain.fake/test',
    connectionId: conn,
    subscriptionId: sub
  });

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
        TableName,
        Key: { connectionId: 'connection-id', subscriptionId: 'subscription-id' }
      }).promise();

      expect(Item).toEqual({
        ...metadata,
        ...vars,
        triggerName: interpolatedTriggerName,
        ttl: expect.any(Number)
      });
    });

  it('should publish to subscriptions listening to triggerName', async () => {
    const { subscriptions, apiGateway } = subscriptionsManager();
    for (let c = 0; c < 10; c++) {
      for (let s = 0; s < 10; s++) {
        await subscriptions.subscribe('onMessage#{chatId}', { ...connection('c' + c, 's' + s), chatId: 'chat:1' });
      }
    }
    await subscriptions.subscribe('onMessage#{chatId}', { ...connection('cx', 's1'), chatId: 'chat:x' });
    await subscriptions.subscribe('onMessage#{chatId}', { ...connection('cy', 's1'), chatId: 'chat:y' });

    const payload = { chatId: 'chat:1', message: 'hello' };
    await subscriptions.publish('onMessage#{chatId}', payload);

    expect(apiGateway.postToConnection).toHaveBeenCalledTimes(100);
    for (let c = 0; c < 10; c++) {
      for (let s = 0; s < 10; s++) {
        expect(apiGateway.postToConnection).toHaveBeenCalledWith({
          ConnectionId: 'c' + c,
          Data: JSON.stringify({
            id: 's' + s,
            type: GQL_DATA,
            payload: { data: { onMessage: payload } }
          })
        });
      }
    }
  });

  it('should query all subscriptions for a connection and unsubscribe all', async () => {
    const { subscriptions, dynamoDb } = subscriptionsManager();
    for (let i = 0; i < 40; i++) {
      await subscriptions.subscribe('onEvent#{type}', { ...connection('c1', 's' + i), type: 'x' });
    }
    await subscriptions.subscribe('onEvent#{type}', { ...connection('c2', 's1'), type: 'x' });
    await subscriptions.subscribe('onEvent#{type}', { ...connection('c2', 's2'), type: 'y' });

    const { Count: before } = await dynamoDb.scan({ TableName, Select: 'COUNT' }).promise();
    expect(before).toEqual(42);

    await subscriptions.unsubscribeAll('c1');

    const { Count: after } = await dynamoDb.scan({ TableName, Select: 'COUNT' }).promise();
    expect(after).toEqual(2);
  });

  it('should unsubscribe specific subscription', async () => {
    const { subscriptions, dynamoDb } = subscriptionsManager();
    for (let i = 0; i < 10; i++) {
      await subscriptions.subscribe('onEvent#{type}', { ...connection('c1', 's' + i), type: 'message' });
    }
    const { Count: before } = await dynamoDb.scan({ TableName, Select: 'COUNT' }).promise();
    expect(before).toEqual(10);

    await subscriptions.unsubscribe('c1', 's0');
    await subscriptions.unsubscribe('c1', 's1');

    const { Count: after } = await dynamoDb.scan({ TableName, Select: 'COUNT' }).promise();
    expect(after).toEqual(8);
  });
});
