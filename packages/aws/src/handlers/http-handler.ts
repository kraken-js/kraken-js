import { GQL_CONNECTION_INIT } from '@kraken.js/core';
import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { parse } from 'graphql';
import lambdaPlayground from 'graphql-playground-middleware-lambda';

export const httpHandler = <T = any>(kraken: Kraken.Runtime): APIGatewayProxyHandler => {
  return async (event: APIGatewayProxyEvent, context?, callback?) => {
    if (!event.requestContext) return { statusCode: 200, body: '' }; // warm up or something else

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, body: '', headers: { 'Cache-Control': 'max-age=31536000' } };
    }

    if (event.httpMethod === 'GET') {
      return await lambdaPlayground({
        endpoint: process.env.GRAPHQL_ENDPOINT,
        subscriptionEndpoint: process.env.GRAPHQL_WS_ENDPOINT
      })(event, context, callback) as any;
    }

    try {
      const connectionId = event.requestContext.connectionId as string;
      const connectedAt = event.requestContext.connectedAt as number;
      const sourceIp = event.requestContext.identity.sourceIp as string;

      const request = JSON.parse(event.body);
      const document = parse(request.query);
      const operationName = request.operationName;
      const variableValues = request.variables;

      const { contextValue } = await kraken.onConnectionInit({
        type: GQL_CONNECTION_INIT,
        payload: event.headers
      });

      const response = await kraken.gqlExecute({
        operationId: event.requestContext.connectionId,
        connectionInfo: {
          apiGatewayUrl: null,
          connectionId,
          connectedAt,
          sourceIp
        },
        document,
        operationName,
        variableValues,
        contextValue
      });

      return {
        statusCode: 200,
        body: JSON.stringify(response)
      };
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          request: event.body,
          reason: error.message
        })
      };
    }
  };
};
