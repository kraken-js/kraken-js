import { ConnectionStore, SubscriptionStore } from '@kraken.js/core';
import { ApiGatewayManagementApi, DynamoDB } from 'aws-sdk';
import { getApiGateway, getDocumentClient } from './instances';

const subscriptionsBatchLoadLimit = 100;
type ApiGatewayFactory = (endpoint: string) => ApiGatewayManagementApi;

interface DynamoDbConfig {
  dynamoDb?: DynamoDB.DocumentClient
  apiGateway?: ApiGatewayFactory
  tableName?: string
}

const rootOperationId = '$connection';

const waitForConnectionTimeout = () =>
  process.env.WS_WAIT_FOR_CONNECTION_TIMEOUT_MS
    ? parseInt(process.env.WS_WAIT_FOR_CONNECTION_TIMEOUT_MS)
    : 50;

const getTableName = () => {
  return `WsSubscriptions-${process.env.STAGE}`;
};

export const waitFor = async (millis: number) => new Promise(resolve => setTimeout(resolve, millis));

const postToConnection = async (apiGateway: ApiGatewayManagementApi, connectionId: string, payload: any) => {
  await apiGateway.postToConnection({
    ConnectionId: connectionId as string,
    Data: JSON.stringify(payload)
  }).promise();
};

export const ttl = (seconds = 7200) => Math.floor(Date.now() / 1000) + seconds; // 2 hours

class DynamoDbConnectionManager<T> implements ConnectionStore {
  protected tableName: string;
  protected dynamoDb: DynamoDB.DocumentClient;
  protected apiGateway: ApiGatewayFactory;

  constructor({ dynamoDb, tableName, apiGateway }: DynamoDbConfig) {
    this.dynamoDb = dynamoDb ? dynamoDb : getDocumentClient();
    this.apiGateway = apiGateway ? apiGateway : endpoint => getApiGateway(endpoint);
    this.tableName = tableName ? tableName : getTableName();
  }

  async save(connection) {
    const item = { ...connection, operationId: rootOperationId, ttl: ttl() };
    await this.dynamoDb.put({
      TableName: this.tableName,
      Item: item
    }).promise();
    return item;
  }

  async get(connectionId: string, retries = 10) {
    const { Item } = await this.dynamoDb.get({
      TableName: this.tableName,
      Key: { connectionId, operationId: rootOperationId }
    }).promise();
    if (!Item) {
      if (retries > 0) {
        await waitFor(waitForConnectionTimeout());
        return this.get(connectionId, --retries);
      }
      throw new Error(`Connection ${connectionId} not found`);
    }
    return Item;
  }

  async delete({ connectionId, apiGatewayUrl }) {
    await Promise.all([
      this.dynamoDb.delete({
        TableName: this.tableName,
        Key: { connectionId, operationId: rootOperationId }
      }).promise(),
      this.apiGateway(apiGatewayUrl).deleteConnection({
        ConnectionId: connectionId
      }).promise().catch(e => void e) // it's ok to fail with 410 here
    ]);
  }

  async send({ connectionId, apiGatewayUrl }, payload: any) {
    const apiGateway = this.apiGateway(apiGatewayUrl as string);
    await postToConnection(apiGateway, connectionId, payload);
  }
}

class DynamoDbSubscriptionManager implements SubscriptionStore {
  protected tableName: string;
  protected dynamoDb: DynamoDB.DocumentClient;
  protected apiGateway: ApiGatewayFactory;

  constructor({ dynamoDb, tableName, apiGateway }: DynamoDbConfig) {
    this.dynamoDb = dynamoDb ? dynamoDb : getDocumentClient();
    this.apiGateway = apiGateway ? apiGateway : endpoint => getApiGateway(endpoint);
    this.tableName = tableName ? tableName : getTableName();
  }

  async save(subscription) {
    const item = { ...subscription, ttl: ttl() };
    await this.dynamoDb.put({
      TableName: this.tableName,
      Item: item
    }).promise();

    return item;
  }

  async delete(connectionId: string, operationId: string) {
    await this.dynamoDb.delete({
      TableName: this.tableName,
      Key: { connectionId, operationId }
    }).promise();
  }

  async deleteAll(connectionId: string) {
    await this.batchDeleteAll(connectionId);
  }

  async findByTriggerName(triggerName: string, lastEvaluatedKey?) {
    const { Items = [], LastEvaluatedKey } = await this.dynamoDb.query({
      TableName: this.tableName,
      IndexName: 'byTriggerName',
      KeyConditionExpression: 'triggerName = :triggerName',
      ExpressionAttributeValues: { ':triggerName': triggerName },
      ProjectionExpression: 'connectionId, operationId, apiGatewayUrl',
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: subscriptionsBatchLoadLimit
    }).promise();
    if (LastEvaluatedKey) {
      return Items.concat(await this.findByTriggerName(triggerName, LastEvaluatedKey));
    }
    return Items;
  }

  private async batchDeleteAll(connectionId: string, lastEvaluatedKey?) {
    const { Items = [], LastEvaluatedKey } = await this.dynamoDb.query({
      TableName: this.tableName,
      KeyConditionExpression: 'connectionId = :connectionId', // AND operationId <> :rootConnectionId (<> not allows in KeyConditionExpression)
      FilterExpression: 'attribute_exists(triggerName)', // only subscriptions have triggerName, root connection does not
      ExpressionAttributeValues: { ':connectionId': connectionId },
      ProjectionExpression: 'connectionId, operationId',
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 25 // max batch write request size
    }).promise();

    if (Items.length > 0) {
      await this.dynamoDb.batchWrite({
        RequestItems: {
          [this.tableName]: Items.map(({ connectionId, operationId }) => ({
            DeleteRequest: { Key: { connectionId, operationId } }
          }))
        }
      }).promise();
    }
    if (LastEvaluatedKey) {
      await this.batchDeleteAll(connectionId, LastEvaluatedKey);
    }
  }
}

export const dynamoDbConnectionStore = <T>(config: DynamoDbConfig = {}) => {
  return new DynamoDbConnectionManager<T>(config);
};

export const dynamoDbSubscriptionStore = (config: DynamoDbConfig = {}) => {
  return new DynamoDbSubscriptionManager(config);
};
