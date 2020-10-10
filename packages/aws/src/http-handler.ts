import { GQL_CONNECTION_INIT, KrakenRuntime } from '@kraken.js/core';
import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { parse } from 'graphql';
import lambdaPlayground from 'graphql-playground-middleware-lambda';

export const httpHandler = <T = any>(kraken: KrakenRuntime): APIGatewayProxyHandler => {
  return async (event: APIGatewayProxyEvent, context?, callback?) => {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, body: '', headers: { 'Cache-Control': 'max-age=31536000' } };
    }
    if (event.httpMethod === 'GET') {
      return await lambdaPlayground({})(event, context, callback) as any;
    }

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
      document,
      operationName,
      variableValues,
      contextValue
    });

    return {
      statusCode: 200,
      body: JSON.stringify(response)
    };
  };
};
