import { KrakenSchema } from '@kraken.js/core';
import { schemaDirectives } from './directives';
import { dynamoDbDataLoader } from './dynamodb-dataloader';
import { dynamoDbConnectionStore, dynamoDbSubscriptionStore } from './dynamodb-stores';
import { getApiGateway, getCognito, getDynamoDb, getLambda, getSNS, getSQS } from './instances';
import { resolvers } from './resolvers';
import { AwsSchemaConfig } from './types';
// @ts-ignore
import * as typeDefs from './schema.graphql';

export const graphqlSchema = (config?: AwsSchemaConfig): KrakenSchema => ({
  typeDefs,
  resolvers,
  schemaDirectives,
  plugins: inject => {
    inject('connections', dynamoDbConnectionStore(config));
    inject('subscriptions', dynamoDbSubscriptionStore(config));
    inject('sns', () => getSNS(config?.sns));
    inject('sqs', () => getSQS(config?.sqs));
    inject('lambda', () => getLambda(config?.lambda));
    inject('dynamoDb', () => getDynamoDb(config?.dynamoDb));
    inject('cognito', () => getCognito(config?.cognito));
    inject('dynamoDbDataLoader', dynamoDbDataLoader);
    inject('apiGateway', () => ({
      get: endpoint => config?.apiGateway || getApiGateway(endpoint)
    }));
  }
});
