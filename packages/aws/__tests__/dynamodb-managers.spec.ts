import { dynamoDbConnectionManager, dynamoDbSubscriptionManager } from '..';
import { ApiGatewayManagementApiMock, DocumentClientMock } from './utils';

const awsStuff = () => {
  const apiGateway = new ApiGatewayManagementApiMock();
  const dynamoDb = new DocumentClientMock(({ connectionId, subscriptionId }) => ({ connectionId, subscriptionId }));
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
    expect(dynamoDb.put).toHaveBeenCalledWith({
      TableName: 'WsSubscriptions-test',
      Item: {
        connectionId: 'c1',
        subscriptionId: '$connection',
        context: { v: 1 }
      }
    });
  });

  it.each([[0, 1], [1, 2]])('should fail to get connection with %s retry', async (retries, times) => {
    const { dynamoDb, connections } = connectionManager();
    await expect(connections.get('c2', retries)).rejects.toThrowError('Connection c2 not found');
    expect(dynamoDb.get).toHaveBeenCalledTimes(times);
    expect(dynamoDb.get).toHaveBeenCalledWith({
      TableName: 'WsSubscriptions-test',
      Key: {
        connectionId: 'c2',
        subscriptionId: '$connection'
      }
    });
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
      expect(dynamoDb.put).toHaveBeenCalledWith({
        TableName: 'WsSubscriptions-test',
        Item: {
          ...metadata,
          ...vars,
          triggerName: interpolatedTriggerName
        }
      });
    });
});
