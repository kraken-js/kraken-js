import AWS from 'aws-sdk';
import { DynamoDB } from 'dynongo';
import { DynamodbDataloader } from './src/schemas/core/dynamodb-dataloader';
import { EventBridgeEmitter } from './src/schemas/events/event-bridge-emitter';

// @ts-ignore
export * as serverless from './resources/serverless.yml';
// @ts-ignore
export * as subscriptions from './resources/serverless-subscriptions.yml';
// @ts-ignore
export * as events from './resources/serverless-eventbus.yml';
// @ts-ignore
export * as manifest from './package.json';

export * from './src/handlers/ws-handler';
export * from './src/handlers/http-handler';
export * from './src/handlers/dynamodb-streams-handler';
export * from './src/schemas/core';
export * from './src/schemas/events';

declare global {
  namespace Kraken {
    interface Context {
      $lambda: AWS.Lambda
      $dynamoDb: AWS.DynamoDB.DocumentClient
      $dynongo: DynamoDB
      $apiGateway: { get: (endpoint: string) => AWS.ApiGatewayManagementApi }
      $sqs: AWS.SQS
      $sns: AWS.SNS
      $s3: AWS.S3
      $dynamoDbDataLoader: DynamodbDataloader
      $cognito: AWS.CognitoIdentityServiceProvider
      $eventBridge: AWS.EventBridge,
      $events: EventBridgeEmitter
    }

    interface ConnectionInfo {
      apiGatewayUrl: string
      connectedAt?: number
      ttl?: number
    }
  }
}
