import { KrakenSchema } from '@kraken.js/core';
import { dynamoDbConnectionStore, dynamoDbSubscriptionStore } from './dynamodb-stores';
import { getApiGateway, getDynamoDb, getLambda, getSNS, getSQS } from './instances';
import { AwsSchemaConfig } from './types';

export const graphqlSchema = (config?: AwsSchemaConfig): KrakenSchema => ({
  plugins: inject => {
    inject('connections', dynamoDbConnectionStore(config));
    inject('subscriptions', dynamoDbSubscriptionStore(config));
    inject('sns', () => getSNS(config?.sns));
    inject('sqs', () => getSQS(config?.sqs));
    inject('lambda', () => getLambda(config?.lambda));
    inject('dynamoDb', () => getDynamoDb(config?.dynamoDb));
    inject('apiGateway', () => ({
      get: endpoint => config.apiGateway || getApiGateway(endpoint)
    }));
  }
});
