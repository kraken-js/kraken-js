import { APIGatewayProxyEvent } from 'aws-lambda';
import { ApiGatewayManagementApi, config as awsConfig, DynamoDB } from 'aws-sdk';
import yn from 'yn';

type Connection = {
  connectionId: string;
  connectedAt: number;
  callbackUrl: string;
  ttl: number;
  context: any;
}

const isOffline = yn(process.env.IS_OFFLINE);
const wsSubscriptionsTableName = process.env.WS_SUBSCRIPTIONS_TABLE as string;
const rootConnectionId = '$connection';
const waitForConnectionTimeout = 50;

const instances: Record<string, any> = {
  apiGateway: {},
  dynamoDb: undefined
};

if (isOffline) {
  awsConfig.update({
    accessKeyId: '__offline__',
    secretAccessKey: '__offline__'
  });
}

export const dynamoDb = (): DynamoDB.DocumentClient => {
  if (!instances.dynamoDb) {
    instances.dynamoDb = new DynamoDB.DocumentClient({
      endpoint: process.env.AWS_DYNAMODB_ENDPOINT
    });
  }
  return instances.dynamoDb;
};

export const apiGateway = (endpoint): ApiGatewayManagementApi => {
  if (!instances.apiGateway[endpoint]) {
    instances.apiGateway[endpoint] = new ApiGatewayManagementApi({
      endpoint: process.env.AWS_API_GATEWAY_ENDPOINT || endpoint
    });
  }
  return instances.apiGateway[endpoint];
};

const ttl = (seconds = 7200) => Math.floor(Date.now() / 1000) + seconds;  // 2 hours

const waitFor = async (millis: number) => new Promise(resolve => setTimeout(resolve, millis));

export const getApiGatewayUrl = (event: APIGatewayProxyEvent) => {
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  return `https://${domainName}/${stage}`;
};

export const deleteApiGatewayConnection = async (connectionId, apiGatewayUrl) => {
  await apiGateway(apiGatewayUrl).deleteConnection({
    ConnectionId: connectionId
  }).promise().catch(e => void e);
};

export const putConnection = async (connection: Partial<Connection>) => {
  const item = {
    ttl: ttl(),
    subscriptionId: rootConnectionId,
    ...connection
  };
  await dynamoDb().put({
    TableName: wsSubscriptionsTableName,
    Item: item
  }).promise();
  return item as Connection;
};

export const getConnection = async (connectionId, retries = 10) => {
  const { Item } = await dynamoDb().get({
    TableName: wsSubscriptionsTableName,
    Key: { connectionId, subscriptionId: rootConnectionId },
    ProjectionExpression: 'connectionId, callbackUrl, context'
  }).promise();

  if (!Item) {
    if (retries > 0) {
      await waitFor(waitForConnectionTimeout);
      return await getConnection(connectionId, --retries);
    }
    throw new Error(`Connection ${connectionId} not found`);
  }

  return Item as Connection;
};

export const deleteConnection = async (connectionId, lastEvaluatedKey?) => {
  const { Items = [], LastEvaluatedKey } = await dynamoDb().query({
    TableName: wsSubscriptionsTableName,
    KeyConditionExpression: 'connectionId = :connectionId',
    ExpressionAttributeValues: { ':connectionId': connectionId },
    ProjectionExpression: 'connectionId, subscriptionId',
    ExclusiveStartKey: lastEvaluatedKey,
    Limit: 25
  }).promise();

  if (Items.length > 0) {
    await dynamoDb().batchWrite({
      RequestItems: {
        [wsSubscriptionsTableName]: Items.map(({ connectionId, subscriptionId }) => ({
          DeleteRequest: { Key: { connectionId, subscriptionId } }
        }))
      }
    }).promise();

    if (LastEvaluatedKey) {
      await deleteConnection(connectionId, LastEvaluatedKey);
    }
  }
};

export const deleteSubscription = async (connectionId, subscriptionId) => {
  await dynamoDb().delete({
    TableName: wsSubscriptionsTableName,
    Key: { connectionId, subscriptionId }
  }).promise();
};

export const postToConnection = async (event: APIGatewayProxyEvent, data: any) => {
  const connectionId = event.requestContext.connectionId as string;
  const apiGatewayUrl = getApiGatewayUrl(event);
  await apiGateway(apiGatewayUrl).postToConnection({
    ConnectionId: connectionId,
    Data: JSON.stringify(data)
  }).promise().catch(error => {
    if (error) {
      if (error.code === 'GoneException') {
        return deleteConnection(connectionId);
      }
    }
    throw error;
  });
};
