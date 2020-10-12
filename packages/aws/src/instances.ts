import {
  ApiGatewayManagementApi,
  CognitoIdentityServiceProvider,
  config as awsConfig,
  DynamoDB,
  Lambda,
  SharedIniFileCredentials,
  SNS,
  SQS
} from 'aws-sdk';
import yn from 'yn';

const isOffline = yn(process.env.IS_OFFLINE);
const dynamoDbEndpoint = process.env.AWS_DYNAMODB_ENDPOINT;
const lambdaEndpoint = process.env.AWS_LAMBDA_ENDPOINT;
const snsEndpoint = process.env.AWS_SNS_ENDPOINT;
const sqsEndpoint = process.env.AWS_SQS_ENDPOINT;
const apiGatewayEndpoint = process.env.AWS_APIGATEWAY_ENDPOINT;

const instances: Record<string, any> = {
  apiGateway: {},
  dynamoDb: undefined,
  lambda: undefined,
  sns: undefined,
  sqs: undefined
};

if (isOffline) {
  awsConfig.update({
    accessKeyId: '__offline__',
    secretAccessKey: '__offline__'
  });
}

export const getLambda = (lambda?: Lambda): Lambda => {
  if (!instances.lambda) {
    instances.lambda = lambda || new Lambda({
      apiVersion: '2015-03-31',
      endpoint: isOffline ? lambdaEndpoint : undefined
    });
  }
  return instances.lambda;
};

export const getDynamoDb = (dynamoDb?: DynamoDB.DocumentClient): DynamoDB.DocumentClient => {
  if (!instances.dynamoDb) {
    instances.dynamoDb = dynamoDb || new DynamoDB.DocumentClient({
      endpoint: isOffline ? dynamoDbEndpoint : undefined
    });
  }
  return instances.dynamoDb;
};

export const getSNS = (sns?: SNS): SNS => {
  if (!instances.sns) {
    instances.sns = sns || new SNS({
      endpoint: isOffline ? snsEndpoint : undefined
    });
  }
  return instances.sns;
};

export const getSQS = (sqs?: SQS): SQS => {
  if (!instances.sqs) {
    instances.sqs = sqs || new SQS({
      endpoint: isOffline ? sqsEndpoint : undefined
    });
  }
  return instances.sqs;
};

export const getApiGateway = (endpoint): ApiGatewayManagementApi => {
  if (!instances.apiGateway[endpoint]) {
    instances.apiGateway[endpoint] = new ApiGatewayManagementApi({
      endpoint: isOffline ? apiGatewayEndpoint : endpoint
    });
  }
  return instances.apiGateway[endpoint];
};

export const getCognito = (cognito?: CognitoIdentityServiceProvider): CognitoIdentityServiceProvider => {
  if (!instances.cognito) {
    if (cognito) return cognito;
    if (isOffline) {
      // not really offline in this case ¯\_(ツ)_/¯
      const profile = process.env.AWS_PROFILE as string;
      const credentials = new SharedIniFileCredentials({ profile });
      instances.cognito = new CognitoIdentityServiceProvider({ credentials });
    } else {
      instances.cognito = new CognitoIdentityServiceProvider({
        region: process.env.COGNITO_AWS_REGION
      });
    }
  }
  return instances.cognito;
};
