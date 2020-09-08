import { ApiGatewayManagementApi, config as awsConfig, DynamoDB, Lambda, SNS } from 'aws-sdk';
import yn from 'yn';

const isOffline = yn(process.env.IS_OFFLINE);
const instances: Record<string, any> = {
  apiGateway: {},
  dynamoDb: undefined,
  lambda: undefined,
  sns: undefined,
  s3: undefined
};

if (isOffline) {
  awsConfig.update({
    accessKeyId: '__offline__',
    secretAccessKey: '__offline__'
  });
}

export const getLambda = (): Lambda => {
  if (!instances.lambda) {
    instances.lambda = new Lambda({
      apiVersion: '2015-03-31',
      endpoint: isOffline ? 'http://localhost:4002' : undefined
    });
  }
  return instances.lambda;
};

export const getDocumentClient = (): DynamoDB.DocumentClient => {
  if (!instances.dynamoDb) {
    instances.dynamoDb = new DynamoDB.DocumentClient({
      endpoint: isOffline ? 'http://localhost:5002' : undefined
    });
  }
  return instances.dynamoDb;
};

export const getSNS = (): SNS => {
  if (!instances.sns) {
    instances.sns = new SNS({
      endpoint: isOffline ? 'http://localhost:6002' : undefined
    });
  }
  return instances.sns;
};

export const getApiGateway = (endpoint): ApiGatewayManagementApi => {
  if (!instances.apiGateway[endpoint]) {
    instances.apiGateway[endpoint] = new ApiGatewayManagementApi({
      endpoint: isOffline ? 'http://localhost:4001' : endpoint
    });
  }
  return instances.apiGateway[endpoint];
};
