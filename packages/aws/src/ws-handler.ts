import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  GQL_COMPLETE,
  GQL_CONNECTION_ACK,
  GQL_CONNECTION_ERROR,
  GQL_CONNECTION_INIT,
  GQL_CONNECTION_TERMINATE,
  GQL_DATA,
  GQL_START,
  GQL_STOP,
  HandlerConfig
} from '@kraken.js/core';
import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { execute, GraphQLSchema, OperationDefinitionNode, parse, validate } from 'graphql';
import { dynamoDbConnectionManager, dynamoDbSubscriptionManager } from './dynamodb-managers';
import { AwsConnection, AwsSubscription } from './types';

export type AwsHandlerConfig<T> = HandlerConfig<AwsConnection<T>, AwsSubscription, T>;
type AwsHandlerConfigWithGraphqlSchema<T> = AwsHandlerConfig<T> & {
  graphqlSchema: GraphQLSchema
}

const WS_CONNECT = '$connect';
const WS_DISCONNECT = '$disconnect';
const okResponse = {
  statusCode: 200,
  body: ''
};

const getApiGatewayUrl = (event: APIGatewayProxyEvent) => {
  return `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
};

const onWsConnect = async <C>(config: AwsHandlerConfigWithGraphqlSchema<C>, event: APIGatewayProxyEvent) => {
  const secWsProtocolHeader = Object.keys(event.headers).find(header =>
    header.toLowerCase() === 'sec-websocket-protocol'
  );
  return secWsProtocolHeader
    ? { ...okResponse, headers: { 'Sec-WebSocket-Protocol': event.headers[secWsProtocolHeader] } }
    : { ...okResponse };
};

const onWsDisconnect = async <C>(config: AwsHandlerConfigWithGraphqlSchema<C>, event: APIGatewayProxyEvent) => {
  const connectionId = event.requestContext.connectionId as string;
  const apiGatewayUrl = getApiGatewayUrl(event);
  await Promise.all([
    config.connections?.delete({ connectionId, apiGatewayUrl }),
    config.subscriptions?.unsubscribeAll(connectionId)
  ]);
};

const onGqlInit = async <C>(config: AwsHandlerConfigWithGraphqlSchema<C>, event: APIGatewayProxyEvent, { payload }) => {
  const context = config.context ? await config.context(payload) : {} as C;
  const apiGatewayUrl = getApiGatewayUrl(event);
  const connection = {
    connectionId: event.requestContext.connectionId as string,
    connectedAt: event.requestContext.connectedAt,
    apiGatewayUrl,
    context
  };
  await config.connections?.save(connection);
  await config.connections?.send(connection, { type: GQL_CONNECTION_ACK });
};

const onGqlStart = async <C>(config: AwsHandlerConfigWithGraphqlSchema<C>, event: APIGatewayProxyEvent, operation: any) => {
  const connectionId = event.requestContext.connectionId as string;
  const apiGatewayUrl = getApiGatewayUrl(event);
  const connection = await config.connections?.get(connectionId).catch(async () => {
    const connectionInfo = { connectionId, apiGatewayUrl };
    await config.connections?.send(connectionInfo, { type: GQL_CONNECTION_ERROR });
    await config.connections?.delete(connectionInfo);
  });

  if (connection) {
    const subscriptionId = operation.id;
    const contextValue = {
      connectionId,
      subscriptionId,
      apiGatewayUrl,
      graphqlSchema: config.graphqlSchema,
      connections: config.connections,
      subscriptions: config.subscriptions,
      operation: operation.payload,
      requestTime: event.requestContext.requestTimeEpoch,
      ...connection.context
    };

    const { graphqlSchema: schema } = config;
    const document = parse(operation.payload.query as string);
    const variableValues = operation.payload.variables;

    const errors = config.validate ? validate(schema, document) : [];
    const response = errors.length > 0 ? { errors } : await execute({
      schema,
      document,
      contextValue,
      variableValues
    });

    // only send response if not subscription request, to avoid sending null response on subscribe initial message
    const operationDefinition = document.definitions[0] as OperationDefinitionNode;
    if (operationDefinition.operation !== 'subscription') {
      await config.connections?.send(connection, {
        id: subscriptionId,
        type: GQL_DATA,
        payload: response
      });
      await config.connections?.send(connection, {
        id: subscriptionId,
        type: GQL_COMPLETE
      });
    }
  }
};

const onGqlStop = async <C>(config: AwsHandlerConfigWithGraphqlSchema<C>, event: APIGatewayProxyEvent, { id }) => {
  const connectionId = event.requestContext.connectionId as string;
  const apiGatewayUrl = getApiGatewayUrl(event);
  await Promise.all([
    config.connections?.send({ connectionId, apiGatewayUrl }, { id, type: GQL_COMPLETE }),
    config.subscriptions?.unsubscribe(connectionId, id)
  ]);
};

const onGqlConnectionTerminate = async <C>(config: AwsHandlerConfigWithGraphqlSchema<C>, event: APIGatewayProxyEvent) => {
  const connectionId = event.requestContext.connectionId as string;
  const apiGatewayUrl = getApiGatewayUrl(event);
  await Promise.all([
    config.connections?.delete({ connectionId, apiGatewayUrl }),
    config.subscriptions?.unsubscribeAll(connectionId)
  ]);
};

export const wsHandler = <T = any>(config: AwsHandlerConfig<T>): APIGatewayProxyHandler => {
  if (!config.connections) config.connections = dynamoDbConnectionManager();
  if (!config.subscriptions) config.subscriptions = dynamoDbSubscriptionManager();
  if (!config.context) config.context = () => ({} as T);
  const graphqlSchema = makeExecutableSchema(config);

  const configWithSchema = {
    ...config,
    graphqlSchema
  };

  return async (event: APIGatewayProxyEvent) => {
    const routeKey = event.requestContext.routeKey as string;

    switch (routeKey) {
      case WS_CONNECT:
        return onWsConnect(configWithSchema, event);
      case WS_DISCONNECT:
        await onWsDisconnect(configWithSchema, event);
        return okResponse;
    }

    const operation = JSON.parse(event.body as string);
    switch (operation.type) {
      case GQL_CONNECTION_INIT:
        await onGqlInit(configWithSchema, event, operation);
        return okResponse;
      case GQL_START:
        await onGqlStart(configWithSchema, event, operation);
        return okResponse;
      case GQL_STOP:
        await onGqlStop(configWithSchema, event, operation);
        return okResponse;
      case GQL_CONNECTION_TERMINATE:
        await onGqlConnectionTerminate(configWithSchema, event);
        return okResponse;
    }

    return okResponse;
  };
};
