import { GQL_CONNECTION_INIT } from '@kraken.js/core';
import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { parse } from 'graphql';
import lambdaPlayground from 'graphql-playground-middleware-lambda';

interface HttpHandlerConfig {
  cors?: {
    origin?: string;
    methods?: string;
    headers?: string;
  } | boolean
}

const getCors = (config?: HttpHandlerConfig) => {
  if (typeof config?.cors === 'boolean') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Credentials': true
    };
  }
  return config?.cors ? {
    'Access-Control-Allow-Origin': config.cors.origin || '*',
    'Access-Control-Allow-Headers': config.cors.headers || 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': config.cors.methods || 'POST, GET, OPTIONS',
    'Access-Control-Allow-Credentials': true
  } : undefined;
};

export const httpHandler = <T = any>(kraken: Kraken.Runtime, config?: HttpHandlerConfig): APIGatewayProxyHandler => {
  return async (event: APIGatewayProxyEvent, context?, callback?) => {
    // warm up or something else
    if (!event.requestContext) {
      return { statusCode: 200, body: '' };
    }

    const cors = getCors(config);

    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        body: '',
        headers: {
          ...cors
        }
      };
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
      const connectionInfo = { connectionId, connectedAt, sourceIp, apiGatewayUrl: null };

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
        connectionInfo,
        document,
        operationName,
        variableValues,
        contextValue
      });

      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: {
          ...cors
        }
      };
    } catch (error) {
      console.error(error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          request: event.body,
          reason: error.message
        }),
        headers: {
          ...cors
        }
      };
    }
  };
};
