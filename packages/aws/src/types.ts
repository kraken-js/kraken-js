import { ApiGatewayManagementApi, DynamoDB, Lambda, SNS, SQS } from 'aws-sdk';

export type AwsSchemaConfig = {
  connections?: {
    tableName?: string
    waitForConnectionTimeout?: number
  }
  subscriptions?: {
    tableName?: string
  },
  dynamoDb?: DynamoDB.DocumentClient
  apiGateway?: ApiGatewayManagementApi
  lambda?: Lambda
  sns?: SNS
  sqs?: SQS
}

