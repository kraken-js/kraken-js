import { ConnectionStore, PubSubOptions, SubscriptionStore } from '@kraken.js/core';
import { ApiGatewayManagementApi } from 'aws-sdk';
import { AwsSchemaConfig } from './config';

const subscriptionsBatchLoadLimit = 75;
const defaultWaitForConnectionTimeout = 50;
const rootOperationId = '$connection';
const connectionsCache = {};

const getTableName = () => {
  return `WsSubscriptions-${process.env.STAGE}`;
};

const waitFor = async (millis: number) => {
  return new Promise(resolve => setTimeout(resolve, millis));
};

const getTtl = (seconds = 14400) => { // 4 hours
  return Math.floor(Date.now() / 1000) + seconds;
};

const postToConnection = async (apiGateway: ApiGatewayManagementApi, connectionId: string, payload: any) => {
  await apiGateway.postToConnection({
    ConnectionId: connectionId as string,
    Data: JSON.stringify(payload)
  }).promise();
};

export const dynamoDbConnectionStore = (config: AwsSchemaConfig) => {
  const tableName = config?.connections?.tableName || getTableName();
  const waitForConnectionTimeout = config?.connections?.waitForConnectionTimeout || defaultWaitForConnectionTimeout;

  return ({ $dynamoDb, $apiGateway, $subscriptions }: Kraken.Context): ConnectionStore => {
    const save = async connection => {
      const item = { ...connection, operationId: rootOperationId, ttl: getTtl() };

      await $dynamoDb.put({
        TableName: tableName,
        Item: item
      }).promise();
      connectionsCache[item.connectionId] = item;

      return item as Kraken.Connection;
    };

    const get = async (connectionId: string, retries = 10) => {
      if (connectionsCache[connectionId]) return connectionsCache[connectionId];

      const { Item: connection } = await $dynamoDb.get({
        TableName: tableName,
        Key: { connectionId, operationId: rootOperationId }
      }).promise();

      if (!connection) {
        if (retries > 0) {
          await waitFor(waitForConnectionTimeout);
          return await get(connectionId, --retries);
        }
        throw new Error(`Connection ${connectionId} not found`);
      }

      connectionsCache[connectionId] = connection;
      return connection;
    };

    const _delete = async ({ connectionId, apiGatewayUrl = null }) => {
      await $dynamoDb.delete({
        TableName: tableName,
        Key: { connectionId, operationId: rootOperationId }
      }).promise();
      delete connectionsCache[connectionId];

      if (apiGatewayUrl) {
        await $apiGateway.get(apiGatewayUrl).deleteConnection({
          ConnectionId: connectionId
        }).promise().catch(e => void e);// it's ok to fail with 410 here
      }
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

  return ({ $dynamoDb, connectionInfo }: Kraken.Context): SubscriptionStore => {
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

      // make operation unique to allow many subscriptions one same operation
      const item = {
        ...subscription,
        operationId: operationId + '#' + triggerName,
        ttl: getTtl()
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

    const findByTriggerName = async (triggerName: string, opts?: PubSubOptions) => {
      return await findAllByTriggerName(triggerName, opts);
    };

    const findAllByTriggerName = async (triggerName: string, opts?: PubSubOptions, lastEvaluatedKey?) => {
      const rebuildOperationId = (item) => {
        const [operationId] = item.operationId.split('#');
        item.operationId = operationId;
        return item;
      };

      const filterExpression = opts?.noSelfSubscriptionUpdate
        ? 'connectionId <> :connectionId'
        : undefined;
      const expressionAttributeValues = opts?.noSelfSubscriptionUpdate
        ? { ':triggerName': triggerName, ':connectionId': connectionInfo?.connectionId }
        : { ':triggerName': triggerName };

      const { Items = [], LastEvaluatedKey } = await $dynamoDb.query({
        TableName: tableName,
        IndexName: 'byTriggerName',
        KeyConditionExpression: 'triggerName = :triggerName',
        ExpressionAttributeValues: expressionAttributeValues,
        FilterExpression: filterExpression,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: subscriptionsBatchLoadLimit
      }).promise();
      if (LastEvaluatedKey) {
        const items = await findAllByTriggerName(triggerName, opts, LastEvaluatedKey);
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
