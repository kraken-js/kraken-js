import { KrakenSchema } from '@kraken.js/core';
import { dynamoDbConnectionStore, dynamoDbSubscriptionStore } from './dynamodb-stores';

export const graphqlSchema: KrakenSchema = {
  plugins: inject => {
    inject('connections', dynamoDbConnectionStore());
    inject('subscriptions', dynamoDbSubscriptionStore());
  }
};
