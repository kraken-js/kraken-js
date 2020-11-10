import { Injector, KrakenSchema } from '@kraken.js/core';
import dynongo from 'dynongo';
import { AwsSchemaConfig } from './core/config';
// @ts-ignore
import * as typeDefs from './core/core.graphql';
import { AwsDynamoDeleteDirective } from './core/directives/aws-dynamo-delete';
import { AwsDynamoGetDirective } from './core/directives/aws-dynamo-get';
import { AwsDynamoModelDirective } from './core/directives/aws-dynamo-model';
import { AwsDynamoQueryDirective } from './core/directives/aws-dynamo-query';
import { AwsDynamoUpsertDirective } from './core/directives/aws-dynamo-upsert';
import { AwsLambdaDirective } from './core/directives/aws-lambda';
import { dynamoDbDataLoader } from './core/dynamodb-dataloader';
import { dynamoDbConnectionStore, dynamoDbSubscriptionStore } from './core/dynamodb-stores';
import { DynamoDbSet } from './core/resolvers/aws-dynamo-set-scalar';
import { getApiGateway, getCognito, getDax, getDynamoDb, getLambda, getS3, getSNS, getSQS } from './instances';

const schemaDirectives = {
  lambda: AwsLambdaDirective,
  model: AwsDynamoModelDirective,
  get: AwsDynamoGetDirective,
  query: AwsDynamoQueryDirective,
  put: AwsDynamoUpsertDirective,
  update: AwsDynamoUpsertDirective,
  delete: AwsDynamoDeleteDirective
};

const resolvers = {
  DynamoDbSet: DynamoDbSet
};

export const graphqlSchema = (config?: AwsSchemaConfig): KrakenSchema => ({
  typeDefs,
  resolvers,
  schemaDirectives,
  plugins: (inject: Injector) => {
    inject('connections', dynamoDbConnectionStore(config));
    inject('subscriptions', dynamoDbSubscriptionStore(config));
    inject('sns', () => config?.sns || getSNS(config?.snsConfig));
    inject('sqs', () => config?.sqs || getSQS(config?.sqsConfig));
    inject('lambda', () => config?.lambda || getLambda(config?.lambdaConfig));
    inject('dynamoDb', () => config?.dynamoDb || getDynamoDb(config?.dynamoDbConfig));
    inject('dax', () => config?.dax || getDax(config?.daxConfig));
    inject('s3', () => config?.s3 || getS3(config?.s3Config));
    inject('cognito', () => config?.cognito || getCognito(config?.cognitoConfig));
    inject('dynamoDbDataLoader', dynamoDbDataLoader);
    inject('apiGateway', () => ({
      get: endpoint => config?.apiGateway || getApiGateway(config?.apiGatewayConfig, endpoint)
    }));
    inject('dynongo', ({ $dynamoDb }) => {
      dynongo.dynamodb = $dynamoDb;
      return dynongo;
    });
  }
});
