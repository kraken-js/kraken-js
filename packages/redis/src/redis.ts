import { Injector, KrakenSchema } from '@kraken.js/core';
import Redis from 'ioredis';
import { RedisSchemaConfig } from './config';
import { redisConnectionStore, redisSubscriptionStore } from './redis-stores';

const createRedisInstance = (config?: RedisSchemaConfig) => (context: Kraken.Context) => {
  context.$redisConnected = true;
  return new Redis(config?.redisUrl);
};

export const graphqlSchema = (config?: RedisSchemaConfig): KrakenSchema => ({
  plugins: (inject: Injector) => {
    inject('redis', createRedisInstance(config));
    inject('connections', redisConnectionStore(config));
    inject('subscriptions', redisSubscriptionStore());
  },
  async onAfterExecute(context: Kraken.Context): Promise<void> {
    // console.log('redis connected', context.$redisConnected);
    // if (context.$redisConnected) {
    //   await context.$redis.quit();
    // }
  }
});
