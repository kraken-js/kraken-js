import AWS from 'aws-sdk';

export type AwsSchemaConfig = {
  connections?: {
    tableName?: string
    waitForConnectionTimeout?: number
  }
  subscriptions?: {
    tableName?: string
  },

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

  cognito?: AWS.CognitoIdentityServiceProvider
  cognitoConfig?: AWS.CognitoIdentityServiceProvider.Types.ClientConfiguration
}

