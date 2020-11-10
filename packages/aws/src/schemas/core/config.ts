import AmazonDaxClient from 'amazon-dax-client';
import AWS from 'aws-sdk';

export interface AmazonDaxClientOptions {
  endpoint?: string;
  endpoints?: ReadonlyArray<string>;
  region?: string;
}

export type AwsSchemaConfig = {
  connections?: {
    tableName?: string
    waitForConnectionTimeout?: number
  }
  subscriptions?: {
    tableName?: string
  },

  dax?: AmazonDaxClient
  daxConfig?: AmazonDaxClientOptions

  dynamoDb?: AWS.DynamoDB.DocumentClient
  dynamoDbConfig?: AWS.DynamoDB.Types.ClientConfiguration

  apiGateway?: AWS.ApiGatewayManagementApi
  apiGatewayConfig?: AWS.ApiGatewayManagementApi.Types.ClientConfiguration

  lambda?: AWS.Lambda
  lambdaConfig?: AWS.Lambda.Types.ClientConfiguration

  sns?: AWS.SNS
  snsConfig?: AWS.SNS.Types.ClientConfiguration

  sqs?: AWS.SQS
  sqsConfig?: AWS.SQS.Types.ClientConfiguration

  s3?: AWS.S3
  s3Config?: AWS.S3.Types.ClientConfiguration

  cognito?: AWS.CognitoIdentityServiceProvider
  cognitoConfig?: AWS.CognitoIdentityServiceProvider.Types.ClientConfiguration
}

