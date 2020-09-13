import { KrakenSchema } from '@kraken.js/core';
import { dynamoDbConnectionStore, dynamoDbSubscriptionStore } from './dynamodb-stores';
import { getDynamoDb, getLambda, getSNS, getSQS } from './instances';

export const graphqlSchema: KrakenSchema = {
  plugins: inject => {
    inject('connections', dynamoDbConnectionStore());
    inject('subscriptions', dynamoDbSubscriptionStore());
    inject('lambda', getLambda());
    inject('dynamodb', getDynamoDb());
    inject('sns', getSNS());
    inject('sqs', getSQS());
  }
};
