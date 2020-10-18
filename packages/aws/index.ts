import {
  ApiGatewayManagementApi,
  CognitoIdentityServiceProvider,
  DynamoDB,
  EventBridge,
  Lambda,
  SNS,
  SQS
} from 'aws-sdk';
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
    interface Plugins {
      $lambda: Lambda
      $dynamoDb: DynamoDB.DocumentClient
      $apiGateway: { get: (endpoint: string) => ApiGatewayManagementApi }
      $sqs: SQS
      $sns: SNS
      $dynamoDbDataLoader: DynamodbDataloader
      $cognito: CognitoIdentityServiceProvider
      $eventBridge: EventBridge,
      $events: EventBridgeEmitter
    }

    interface ConnectionInfo {
      apiGatewayUrl: string
      connectedAt?: number
      ttl?: number
    }
  }
}
