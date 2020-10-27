import { ConnectionStore, SubscriptionStore } from '@kraken.js/core';
import { ApiGatewayManagementApi } from 'aws-sdk';
import { AwsSchemaConfig } from './config';

const subscriptionsBatchLoadLimit = 75;
const defaultWaitForConnectionTimeout = 50;
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

export const dynamoDbConnectionStore = (config: AwsSchemaConfig) => {
  const tableName = config?.connections?.tableName || getTableName();
  const waitForConnectionTimeout = config?.connections?.waitForConnectionTimeout || defaultWaitForConnectionTimeout;

  return ({ $dynamoDb, $dynamoDbDataLoader, $apiGateway, $subscriptions }: Kraken.Context): ConnectionStore => {

    const save = async connection => {
      const item = { ...connection, operationId: rootOperationId, ttl: ttl() };

      await $dynamoDb.put({
        TableName: tableName,
        Item: item
      }).promise();

      return item as Kraken.Connection;
    };

    const get = async (connectionId: string, retries = 10) => {
      const request = {
        TableName: tableName,
        Key: { connectionId, operationId: rootOperationId }
      };

      const connection = await $dynamoDbDataLoader.load(request);
      if (!connection) {
        if (retries > 0) {
          $dynamoDbDataLoader.clear(request);
          await waitFor(waitForConnectionTimeout);
          return await get(connectionId, --retries);
        }
        throw new Error(`Connection ${connectionId} not found`);
      }
      return connection;
    };

    const _delete = async ({ connectionId, apiGatewayUrl = null }) => {
      const request = {
        TableName: tableName,
        Key: { connectionId, operationId: rootOperationId }
      };

      await $dynamoDb.delete(request).promise();
      if (apiGatewayUrl) {
        await $apiGateway.get(apiGatewayUrl).deleteConnection({
          ConnectionId: connectionId
        }).promise().catch(e => void e);// it's ok to fail with 410 here
      }

      $dynamoDbDataLoader.clear(request); // cleanup loader
    };

    const send = async ({ connectionId, apiGatewayUrl }, payload: any) => {
      const apiGateway = $apiGateway.get(apiGatewayUrl as string);
      await postToConnection(apiGateway, connectionId, payload).catch(() =>
        Promise.all([
          _delete({ connectionId }),
          $subscriptions.deleteAll(connectionId)
        ])
      );
    };

    return {
      save,
      get,
      delete: _delete,
      send
    };
  };
};

export const dynamoDbSubscriptionStore = (config: AwsSchemaConfig) => {
  const tableName = config?.connections?.tableName || getTableName();

  return ({ $dynamoDb }: Kraken.Context): SubscriptionStore => {

    const batchDelete = async (connectionId: string, operationId?: string, lastEvaluatedKey?) => {
      const keyConditionExpression = operationId
        ? 'connectionId = :connectionId AND begins_with(operationId, :operationId)'
        : 'connectionId = :connectionId';
      const expressionAttributeValues = operationId
        ? { ':connectionId': connectionId, ':operationId': operationId }
        : { ':connectionId': connectionId };

      const { Items = [], LastEvaluatedKey } = await $dynamoDb.query({
        TableName: tableName,
        KeyConditionExpression: keyConditionExpression,
        FilterExpression: 'attribute_exists(triggerName)', // only subscriptions have triggerName, root connection does not
        ExpressionAttributeValues: expressionAttributeValues,
        ProjectionExpression: 'connectionId, operationId',
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 25 // max batch write request size
      }).promise();

      if (Items.length > 0) {
        await $dynamoDb.batchWrite({
          RequestItems: {
            [tableName]: Items.map(({ connectionId, operationId }) => ({
              DeleteRequest: { Key: { connectionId, operationId } }
            }))
          }
        }).promise();
      }
      if (LastEvaluatedKey) {
        await batchDelete(connectionId, operationId, LastEvaluatedKey);
      }
    };

    const save = async subscription => {
      const { operationId, triggerName } = subscription;

      // make operation unique tp allow many subscriptions one same operation
      const item = {
        ...subscription,
        operationId: operationId + '#' + triggerName,
        ttl: ttl()
      };

      await $dynamoDb.put({
        TableName: tableName,
        Item: item
      }).promise();

      return item as Kraken.Subscription;
    };

    const _delete = async (connectionId: string, operationId: string) => {
      await batchDelete(connectionId, operationId);
    };

    const deleteAll = async (connectionId: string) => {
      await batchDelete(connectionId);
    };

    const findByTriggerName = async (triggerName: string, lastEvaluatedKey?) => {
      const rebuildOperationId = (item) => {
        const [operationId] = item.operationId.split('#');
        item.operationId = operationId;
        return item;
      };

      const { Items = [], LastEvaluatedKey } = await $dynamoDb.query({
        TableName: tableName,
        IndexName: 'byTriggerName',
        KeyConditionExpression: 'triggerName = :triggerName',
        ExpressionAttributeValues: { ':triggerName': triggerName },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: subscriptionsBatchLoadLimit
      }).promise();
      if (LastEvaluatedKey) {
        const items = await findByTriggerName(triggerName, LastEvaluatedKey);
        return Items.map(rebuildOperationId).concat(items);
      }
      return Items.map(rebuildOperationId);
    };

    return {
      save,
      delete: _delete,
      deleteAll,
      findByTriggerName
    };
  };
};
