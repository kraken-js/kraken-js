import AWS from 'aws-sdk';
import { Redis } from 'ioredis';

// @ts-ignore
export * as manifest from './package.json';
export * from './src/redis';

declare global {
  namespace Kraken {
    interface Context {
      $redis: Redis
      $redisConnected: boolean
      $apiGateway: { get: (endpoint: string) => AWS.ApiGatewayManagementApi }
    }
  }
}
