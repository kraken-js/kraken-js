import { ConnectionStore, SubscriptionStore } from '@kraken.js/core';
import { ApiGatewayManagementApi } from 'aws-sdk';
import { AwsSchemaConfig } from './config';

const subscriptionsBatchLoadLimit = 75;
const waitForConnectionTimeout = 50;
const rootOperationId = '$connection';

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

class DynamoDbConnectionStore<T> implements ConnectionStore {
  protected tableName: string;
  protected waitForConnectionTimeout: number;

  constructor(protected config: AwsSchemaConfig, protected context: Kraken.ExecutionContext) {
    this.tableName = config?.connections?.tableName || getTableName();
    this.waitForConnectionTimeout = config?.connections?.waitForConnectionTimeout || waitForConnectionTimeout;
  }

  async save(connection) {
    const item = { ...connection, operationId: rootOperationId, ttl: ttl() };
    await this.context.$dynamoDb.put({
      TableName: this.tableName,
      Item: item
    }).promise();
    return item;
  }

  async get(connectionId: string, retries = 10) {
    const request = {
      TableName: this.tableName,
      Key: { connectionId, operationId: rootOperationId }
    };

    const connection = await this.context.$dynamoDbDataLoader.load(request);
    if (!connection) {
      if (retries > 0) {
        this.context.$dynamoDbDataLoader.clear(request);
        await waitFor(this.waitForConnectionTimeout);
        return await this.get(connectionId, --retries);
      }
      throw new Error(`Connection ${connectionId} not found`);
    }
    return connection;
  }

  async delete({ connectionId, apiGatewayUrl }) {
    const request = {
      TableName: this.tableName,
      Key: { connectionId, operationId: rootOperationId }
    };
    await Promise.all([
      this.context.$dynamoDb.delete(request).promise(),
      this.context.$apiGateway.get(apiGatewayUrl).deleteConnection({
        ConnectionId: connectionId
      }).promise().catch(e => void e) // it's ok to fail with 410 here
    ]);
    this.context.$dynamoDbDataLoader.clear(request); // cleanup loader
  }

  async send({ connectionId, apiGatewayUrl }, payload: any) {
    const apiGateway = this.context.$apiGateway.get(apiGatewayUrl as string);
    await postToConnection(apiGateway, connectionId, payload).catch(() =>
      Promise.all([
        this.context.$connections.delete({ connectionId }),
        this.context.$subscriptions.deleteAll(connectionId)
      ])
    );
  }
}

class DynamoDbSubscriptionStore implements SubscriptionStore {
  protected tableName: string;

  constructor(protected config: AwsSchemaConfig, protected context: Kraken.ExecutionContext) {
    this.tableName = config?.connections?.tableName || getTableName();
  }

  async save(subscription) {
    const { operationId, triggerName } = subscription;

    // make operation unique tp allow many subscriptions one same operation
    const item = {
      ...subscription,
      operationId: operationId + '#' + triggerName,
      ttl: ttl()
    };

    await this.context.$dynamoDb.put({
      TableName: this.tableName,
      Item: item
    }).promise();

    return item;
  }

  async delete(connectionId: string, operationId: string) {
    await this.batchDelete(connectionId, operationId);
  }

  async deleteAll(connectionId: string) {
    await this.batchDelete(connectionId);
  }

  async findByTriggerName(triggerName: string, lastEvaluatedKey?) {
    const rebuildOperationId = (item) => {
      const [operationId] = item.operationId.split('#');
      item.operationId = operationId;
      return item;
    };

    const { Items = [], LastEvaluatedKey } = await this.context.$dynamoDb.query({
      TableName: this.tableName,
      IndexName: 'byTriggerName',
      KeyConditionExpression: 'triggerName = :triggerName',
      ExpressionAttributeValues: { ':triggerName': triggerName },
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: subscriptionsBatchLoadLimit
    }).promise();
    if (LastEvaluatedKey) {
      const items = await this.findByTriggerName(triggerName, LastEvaluatedKey);
      return Items.map(rebuildOperationId).concat(items);
    }
    return Items.map(rebuildOperationId);
  }

  private async batchDelete(connectionId: string, operationId?: string, lastEvaluatedKey?) {
    const keyConditionExpression = operationId
      ? 'connectionId = :connectionId AND begins_with(operationId, :operationId)'
      : 'connectionId = :connectionId';
    const expressionAttributeValues = operationId
      ? { ':connectionId': connectionId, ':operationId': operationId }
      : { ':connectionId': connectionId };

    const { Items = [], LastEvaluatedKey } = await this.context.$dynamoDb.query({
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      FilterExpression: 'attribute_exists(triggerName)', // only subscriptions have triggerName, root connection does not
      ExpressionAttributeValues: expressionAttributeValues,
      ProjectionExpression: 'connectionId, operationId',
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 25 // max batch write request size
    }).promise();

    if (Items.length > 0) {
      await this.context.$dynamoDb.batchWrite({
        RequestItems: {
          [this.tableName]: Items.map(({ connectionId, operationId }) => ({
            DeleteRequest: { Key: { connectionId, operationId } }
          }))
        }
      }).promise();
    }
    if (LastEvaluatedKey) {
      await this.batchDelete(connectionId, operationId, LastEvaluatedKey);
    }
  }
}

export const dynamoDbConnectionStore = (config: AwsSchemaConfig) => (context: Kraken.ExecutionContext) => {
  return new DynamoDbConnectionStore(config, context);
};

export const dynamoDbSubscriptionStore = (config: AwsSchemaConfig) => (context: Kraken.ExecutionContext) => {
  return new DynamoDbSubscriptionStore(config, context);
};
