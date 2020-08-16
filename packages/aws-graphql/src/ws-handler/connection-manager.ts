import { GraphQLModule } from '@graphql-modules/core';
import { GraphQLRequest } from 'apollo-server-types';
import { APIGatewayProxyEvent } from 'aws-lambda';

export interface OperationRequest {
  id: string;
  type: string;
  payload: GraphQLRequest;
}

export const getOperationFromEvent = (event: APIGatewayProxyEvent): OperationRequest => {
  return JSON.parse(event.body as string);
};

export abstract class ConnectionManager {
  constructor(protected graphQLModule: GraphQLModule) {
  }

  abstract async wsConnect(event: APIGatewayProxyEvent);

  abstract async wsDisconnect(event: APIGatewayProxyEvent);

  abstract async gqlConnectionInit(event: APIGatewayProxyEvent);

  abstract async gqlStart(event: APIGatewayProxyEvent);

  abstract async gqlStop(event: APIGatewayProxyEvent);

  abstract async gqlConnectionTerminate(event: APIGatewayProxyEvent);
}
