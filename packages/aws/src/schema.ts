import { KrakenSchema } from '@kraken.js/core';
import { dynamoDbConnectionStore, dynamoDbSubscriptionStore } from './dynamodb-stores';

export const dynamoDbStores: KrakenSchema = {
  plugins: inject => {
    inject('connections', dynamoDbConnectionStore());
    inject('subscriptions', dynamoDbSubscriptionStore());
  }
};
