import { ConnectionManager, GQL_DATA, Payload, SubscriptionManager } from '@kraken.js/core';
import { ApiGatewayManagementApi, DynamoDB } from 'aws-sdk';
import { getApiGateway, getDocumentClient } from './instances';
import { AwsConnection, AwsConnectionInfo, AwsSubscription } from './types';

const subscriptionsBatchLoadLimit = 100;
type ApiGatewayFactory = (endpoint: string) => ApiGatewayManagementApi;

interface DynamoDbConfig {
  dynamoDb?: DynamoDB.DocumentClient
  apiGateway?: ApiGatewayFactory
  tableName?: string
}

const rootSubscriptionId = '$connection';
const variablesPrefix = '$';

const waitForConnectionTimeout = () =>
  process.env.WS_WAIT_FOR_CONNECTION_TIMEOUT_MS
    ? parseInt(process.env.WS_WAIT_FOR_CONNECTION_TIMEOUT_MS)
    : 50;

const getTableName = () => {
  return `WsSubscriptions-${process.env.STAGE}`;
};

const interpolate = (string: string, values: any) => {
  return string.replace(/{(.*?)}/g, (match, offset) => values[offset as string] as string || '');
};

const makeVariables = (payload: any) => {
  return Object.entries(payload).reduce((vars, [key, value]) => {
    if (value !== undefined) vars[variablesPrefix + key] = value;
    return vars;
  }, {});
};

export const waitFor = async (millis: number) => new Promise(resolve => setTimeout(resolve, millis));

const postToConnection = async (apiGateway: ApiGatewayManagementApi, connectionId: string, payload: any) => {
  await apiGateway.postToConnection({
    ConnectionId: connectionId as string,
    Data: JSON.stringify(payload)
  }).promise();
};

export const ttl = (seconds = 7200) => Math.floor(Date.now() / 1000) + seconds; // 2 hours

class DynamoDbConnectionManager<T> implements ConnectionManager<AwsConnection<T>, T> {
  protected tableName: string;
  protected dynamoDb: DynamoDB.DocumentClient;
  protected apiGateway: ApiGatewayFactory;

  constructor({ dynamoDb, tableName, apiGateway }: DynamoDbConfig) {
    this.dynamoDb = dynamoDb ? dynamoDb : getDocumentClient();
    this.apiGateway = apiGateway ? apiGateway : endpoint => getApiGateway(endpoint);
    this.tableName = tableName ? tableName : getTableName();
  }

  async save(connection: Partial<AwsConnection<T>>) {
    const item = { ...connection, subscriptionId: rootSubscriptionId, ttl: ttl() };
    await this.dynamoDb.put({
      TableName: this.tableName,
      Item: item
    }).promise();
    return item as unknown as AwsConnection<T>;
  }

  async get(connectionId: string, retries = 10) {
    const { Item } = await this.dynamoDb.get({
      TableName: this.tableName,
      Key: { connectionId, subscriptionId: rootSubscriptionId }
    }).promise();
    if (!Item) {
      if (retries > 0) {
        await waitFor(waitForConnectionTimeout());
        return this.get(connectionId, --retries);
      }
      throw new Error(`Connection ${connectionId} not found`);
    }
    return Item as AwsConnection<T>;
  }

  async delete({ connectionId, apiGatewayUrl }: AwsConnectionInfo<T>) {
    await Promise.all([
      this.dynamoDb.delete({
        TableName: this.tableName,
        Key: { connectionId, subscriptionId: rootSubscriptionId }
      }).promise(),
      this.apiGateway(apiGatewayUrl).deleteConnection({
        ConnectionId: connectionId
      }).promise().catch(e => void e) // it's ok to fail with 410 here
    ]);
  }

  async send({ connectionId, apiGatewayUrl }: AwsConnectionInfo<T>, payload: any) {
    const apiGateway = this.apiGateway(apiGatewayUrl as string);
    await postToConnection(apiGateway, connectionId, payload);
  }
}

class DynamoDbSubscriptionManager implements SubscriptionManager<AwsSubscription> {
  protected tableName: string;
  protected dynamoDb: DynamoDB.DocumentClient;
  protected apiGateway: ApiGatewayFactory;

  constructor({ dynamoDb, tableName, apiGateway }: DynamoDbConfig) {
    this.dynamoDb = dynamoDb ? dynamoDb : getDocumentClient();
    this.apiGateway = apiGateway ? apiGateway : endpoint => getApiGateway(endpoint);
    this.tableName = tableName ? tableName : getTableName();
  }

  async subscribe(triggerName: string, options: Omit<AwsSubscription, 'triggerName'>) {
    const { connectionId, subscriptionId, apiGatewayUrl, ...payload } = options;
    const variables = makeVariables(payload);
    const item = {
      connectionId,
      subscriptionId,
      apiGatewayUrl,
      triggerName: interpolate(triggerName, options),
      ttl: ttl(),
      ...variables
    };
    await this.dynamoDb.put({
      TableName: this.tableName,
      Item: item
    }).promise();
  }

  async unsubscribe(connectionId: string, subscriptionId: string) {
    await this.dynamoDb.delete({
      TableName: this.tableName,
      Key: { connectionId, subscriptionId }
    }).promise();
  }

  async unsubscribeAll(connectionId: string) {
    await this.batchUnsubscribe(connectionId);
  }

  async publish(triggerName: string, payload: Payload) {
    await this.batchPublish(triggerName, payload);
  }

  private async batchUnsubscribe(connectionId: string, lastEvaluatedKey?) {
    const { Items = [], LastEvaluatedKey } = await this.dynamoDb.query({
      TableName: this.tableName,
      KeyConditionExpression: 'connectionId = :connectionId', // AND subscriptionId <> :rootConnectionId (<> not allows in KeyConditionExpression)
      FilterExpression: 'attribute_exists(triggerName)', // only subscriptions have triggerName, root connection does not
      ExpressionAttributeValues: { ':connectionId': connectionId },
      ProjectionExpression: 'connectionId, subscriptionId',
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 25 // max batch write request size
    }).promise();

    if (Items.length > 0) {
      await this.dynamoDb.batchWrite({
        RequestItems: {
          [this.tableName]: Items.map(({ connectionId, subscriptionId }) => ({
            DeleteRequest: { Key: { connectionId, subscriptionId } }
          }))
        }
      }).promise();
    }
    if (LastEvaluatedKey) {
      await this.batchUnsubscribe(connectionId, LastEvaluatedKey);
    }
  }

  private async batchPublish(triggerName: string, payload: Payload, lastEvaluatedKey?) {
    const subscriptionName = triggerName.split('#')[0];
    const interpolatedTriggerName = interpolate(triggerName, payload);
    const { Items = [], LastEvaluatedKey } = await this.dynamoDb.query({
      TableName: this.tableName,
      IndexName: 'byTriggerName',
      KeyConditionExpression: 'triggerName = :triggerName',
      ExpressionAttributeValues: { ':triggerName': interpolatedTriggerName },
      ProjectionExpression: 'connectionId, subscriptionId, apiGatewayUrl',
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: subscriptionsBatchLoadLimit
    }).promise();

    const { __metadata = {} } = payload;
    await Promise.all(
      Items.map(({ connectionId, subscriptionId, apiGatewayUrl }) => {
        const apiGateway = this.apiGateway(apiGatewayUrl as string);
        return postToConnection(apiGateway, connectionId, {
          id: subscriptionId,
          type: GQL_DATA,
          payload: { data: { [subscriptionName]: { ...payload, ...__metadata } } }
        });
      })
    );
    if (LastEvaluatedKey) {
      await this.batchPublish(triggerName, payload, LastEvaluatedKey);
    }
  }
}

export const dynamoDbConnectionManager = <T>(config: DynamoDbConfig = {}) => {
  return new DynamoDbConnectionManager<T>(config);
};

export const dynamoDbSubscriptionManager = (config: DynamoDbConfig = {}) => {
  return new DynamoDbSubscriptionManager(config);
};
