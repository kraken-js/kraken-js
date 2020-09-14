import { KrakenSchema } from '@kraken.js/core';
import { dynamoDbConnectionStore, dynamoDbSubscriptionStore } from './dynamodb-stores';
import { getDynamoDb, getLambda, getSNS, getSQS } from './instances';
import { AwsSchemaConfig } from './types';

export const graphqlSchema = (config?: AwsSchemaConfig): KrakenSchema => ({
  plugins: inject => {
    inject('connections', dynamoDbConnectionStore(config));
    inject('subscriptions', dynamoDbSubscriptionStore(config));
    inject('lambda', getLambda);
    inject('dynamodb', getDynamoDb);
    inject('sns', getSNS);
    inject('sqs', getSQS);
  }
});
