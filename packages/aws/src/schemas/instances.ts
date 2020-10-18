import AWS, { config as awsConfig, EventBridge } from 'aws-sdk';
import yn from 'yn';

const isOffline = yn(process.env.IS_OFFLINE);

const instances: Record<string, any> = {
  apiGateway: {}
};

if (isOffline) {
  awsConfig.update({
    accessKeyId: '__offline__',
    secretAccessKey: '__offline__'
  });
}

export const getLambda = (config?: AWS.Lambda.Types.ClientConfiguration): AWS.Lambda => {
  if (!instances.lambda) {
    instances.lambda = new AWS.Lambda(config);
  }
  return instances.lambda;
};

export const getDynamoDb = (config?: AWS.DynamoDB.Types.ClientConfiguration): AWS.DynamoDB.DocumentClient => {
  if (!instances.dynamoDb) {
    instances.dynamoDb = new AWS.DynamoDB.DocumentClient(config);
  }
  return instances.dynamoDb;
};

export const getSNS = (config?: AWS.SNS.Types.ClientConfiguration): AWS.SNS => {
  if (!instances.sns) {
    instances.sns = new AWS.SNS(config);
  }
  return instances.sns;
};

export const getSQS = (config?: AWS.SQS.Types.ClientConfiguration): AWS.SQS => {
  if (!instances.sqs) {
    instances.sqs = new AWS.SQS(config);
  }
  return instances.sqs;
};

export const getEventBridge = (config: AWS.EventBridge.Types.ClientConfiguration) => {
  if (!instances.eventBridge) {
    instances.eventBridge = new EventBridge(config);
  }
  return instances.eventBridge;
};

export const getCognito = (config?: AWS.CognitoIdentityServiceProvider.Types.ClientConfiguration): AWS.CognitoIdentityServiceProvider => {
  if (!instances.cognito) {
    instances.cognito = new AWS.CognitoIdentityServiceProvider(config);
  }
  return instances.cognito;
};

export const getApiGateway = (config: AWS.ApiGatewayManagementApi.Types.ClientConfiguration, endpoint): AWS.ApiGatewayManagementApi => {
  if (!instances.apiGateway[endpoint]) {
    instances.apiGateway[endpoint] = new AWS.ApiGatewayManagementApi({
      endpoint,
      ...config
    });
  }
  return instances.apiGateway[endpoint];
};
