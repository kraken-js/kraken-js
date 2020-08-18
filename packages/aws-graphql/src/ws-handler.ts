import { GraphQLModule } from '@graphql-modules/core';
import { GraphQLModuleOptions } from '@graphql-modules/core/dist/graphql-module';
import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { getOperationFromEvent } from './ws-handler/connection-manager';
import { DynamoDbConnectionManager } from './ws-handler/connection-manager-aws';
import {
  GQL_CONNECTION_INIT,
  GQL_CONNECTION_TERMINATE,
  GQL_START,
  GQL_STOP,
  okResponse,
  WS_CONNECT,
  WS_DISCONNECT
} from './ws-handler/constants';

const toLowerCaseProperties = object =>
  Object.entries(object).reduce((res, [key, value]) => {
    res[key.toLowerCase()] = value;
    return res;
  }, {});

const wsConnectResponse = (event: APIGatewayProxyEvent) => {
  const wsProtocol = toLowerCaseProperties(event.headers)['sec-websocket-protocol'];
  if (wsProtocol) {
    return { statusCode: 200, body: '', headers: { 'Sec-WebSocket-Protocol': wsProtocol } };
  }
  return okResponse;
};

export const wsHandler = (config: GraphQLModuleOptions<any, any, any, any>): APIGatewayProxyHandler => {
  const graphQLModule = new GraphQLModule({
    ...config,
    visitSchemaDirectives: true
  });
  const connectionManager = new DynamoDbConnectionManager(graphQLModule);

  return async (event: APIGatewayProxyEvent) => {
    const routeKey = event.requestContext.routeKey as string;

    switch (routeKey) {
      case WS_CONNECT:
        await connectionManager.wsConnect();
        return wsConnectResponse(event);
      case WS_DISCONNECT:
        await connectionManager.wsDisconnect(event);
        return okResponse;
    }

    const operation = getOperationFromEvent(event);
    switch (operation.type) {
      case GQL_CONNECTION_INIT:
        await connectionManager.gqlConnectionInit(event);
        return okResponse;
      case GQL_START:
        await connectionManager.gqlStart(event);
        return okResponse;
      case GQL_STOP:
        await connectionManager.gqlStop(event);
        return okResponse;
      case GQL_CONNECTION_TERMINATE:
        await connectionManager.gqlConnectionTerminate(event);
        return okResponse;
    }

    return okResponse;
  };
};
