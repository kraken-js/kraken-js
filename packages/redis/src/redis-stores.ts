import { ConnectionStore, PubSubOptions, SubscriptionStore } from '@kraken.js/core';
import { ApiGatewayManagementApi } from 'aws-sdk';
import { RedisSchemaConfig } from './config';

const defaultWaitForConnectionTimeout = 50;
export const waitFor = async (millis: number) => new Promise(resolve => setTimeout(resolve, millis));

const postToConnection = async (apiGateway: ApiGatewayManagementApi, connectionId: string, payload: any) => {
  await apiGateway.postToConnection({
    ConnectionId: connectionId as string,
    Data: JSON.stringify(payload)
  }).promise();
};

export const redisConnectionStore = (config?: RedisSchemaConfig) => {
  const waitForConnectionTimeout = config?.connections?.waitForConnectionTimeout || defaultWaitForConnectionTimeout;

  return ({ $redis, $apiGateway, $subscriptions }: Kraken.Context): ConnectionStore => {

    const save = async (connection: Partial<Kraken.Connection>): Promise<Kraken.Connection> => {
      const key = connection.connectionId + '#$root';
      await $redis.set(key, JSON.stringify(connection), 'ex', 7200); // 2 hours
      return connection as Kraken.Connection;
    };

    const get = async (connectionId: string, retries = 10): Promise<Kraken.Connection> => {
      const key = connectionId + '#$root';
      const connection = await $redis.get(key);
      if (!connection) {
        if (retries > 0) {
          await waitFor(waitForConnectionTimeout);
          return await get(connectionId, --retries);
        }
        throw new Error(`Connection ${connectionId} not found (${waitForConnectionTimeout}ms)`);
      }
      return JSON.parse(connection);
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

    const _delete = async function(connection: Partial<Kraken.Connection>): Promise<void> {
      const key = connection.connectionId + '#$root';
      await $redis.del(key);
    };

    return {
      save,
      get,
      send,
      delete: _delete
    };
  };
};

export const redisSubscriptionStore = () => {
  return ({ $redis }: Kraken.Context): SubscriptionStore => {
    return {
      async save(subscription: Partial<Kraken.Subscription>): Promise<Kraken.Subscription> {
        const { connectionId, operationId, triggerName } = subscription;
        const key = [connectionId, operationId].join('#');

        const value = JSON.stringify(subscription);
        await $redis.hset(connectionId, operationId, value);
        await $redis.hset(triggerName, key, value);

        return subscription as Kraken.Subscription;
      },
      async delete(connectionId: string, operationId: string): Promise<void> {
        const key = [connectionId, operationId].join('#');

        const subscription = await $redis.hget(connectionId, operationId);
        if (subscription) {
          const { triggerName } = JSON.parse(subscription);
          await $redis.hdel(connectionId, operationId);
          await $redis.hdel(triggerName, key);
        }
      },
      async deleteAll(connectionId: string): Promise<void> {
        const all = await $redis.hgetall(connectionId);
        const subscriptions = Object.values(all);

        for (const subscription of subscriptions) {
          const { operationId, triggerName } = JSON.parse(subscription);
          const key = [connectionId, operationId].join('#');
          await $redis.hdel(connectionId, operationId);
          await $redis.hdel(triggerName, key);
        }
      },
      async findByTriggerName(triggerName: string, opts?: PubSubOptions): Promise<Kraken.Subscription[]> {
        const all = await $redis.hgetall(triggerName);
        return Object.values(all).map(s => JSON.parse(s));
      }
    };
  };
};
