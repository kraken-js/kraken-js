import { ConnectionStore, SubscriptionStore } from '@kraken.js/core';

export const mockRootPlugins = (inject) => {
  const connections = {};
  const subscriptions = {};
  const send = jest.fn();

  inject('connections', () => ({
    async get(connectionId: string): Promise<Kraken.Connection> {
      if (!connections[connectionId]) throw new Error('connection ' + connectionId + ' not found');
      return connections[connectionId] as Kraken.Connection;
    },
    async save(connection: Partial<Kraken.Connection>): Promise<Kraken.Connection> {
      connections[connection.connectionId] = connection;
      return connection as Kraken.Connection;
    },
    async delete(connection): Promise<void> {
      delete connections[connection.connectionId];
    },
    send: send as any
  } as ConnectionStore));

  inject('subscriptions', () => ({
    async save(subscription: Partial<Kraken.Subscription>): Promise<Kraken.Subscription> {
      subscriptions[subscription.connectionId + '#' + subscription.operationId] = subscription;
      return subscription as Kraken.Subscription;
    },
    async delete(connectionId: string, operationId: string): Promise<void> {
      delete subscriptions[connectionId + '#' + operationId];
    },
    async deleteAll(connectionId: string): Promise<void> {
      for (const subscriptionsKey in subscriptions) {
        if (subscriptionsKey.startsWith(connectionId)) {
          delete subscriptions[subscriptionsKey];
        }
      }
    },
    async findByTriggerName(triggerName: string): Promise<Kraken.Subscription[]> {
      return Object.values(subscriptions)
        .filter((sub: Kraken.Subscription) => {
          return sub.triggerName === triggerName;
        }) as Kraken.Subscription[];
    }
  } as SubscriptionStore));
};
