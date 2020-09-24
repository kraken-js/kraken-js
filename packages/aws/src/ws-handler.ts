import { GQL_CONNECTION_INIT, GQL_CONNECTION_TERMINATE, GQL_START, GQL_STOP, KrakenRuntime } from '@kraken.js/core';
import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';

const region = process.env.AWS_REGION;
const WS_CONNECT = '$connect';
const WS_DISCONNECT = '$disconnect';
const okResponse = {
  statusCode: 200,
  body: ''
};

const getApiGatewayUrl = (event: APIGatewayProxyEvent) => {
  return `https://${event.requestContext.apiId}.execute-api.${region}.amazonaws.com/${event.requestContext.stage}`;
};

const onWsConnect = <C>(event: APIGatewayProxyEvent) => {
  const secWsProtocolHeader = Object.keys(event.headers).find(header =>
    header.toLowerCase() === 'sec-websocket-protocol'
  );
  return secWsProtocolHeader
    ? { ...okResponse, headers: { 'Sec-WebSocket-Protocol': event.headers[secWsProtocolHeader] } }
    : { ...okResponse };
};

export const wsHandler = <T = any>(kraken: KrakenRuntime): APIGatewayProxyHandler => {
  return async (event: APIGatewayProxyEvent) => {
    if (!event.requestContext) return okResponse; // warm up or something else

    const routeKey = event.requestContext.routeKey as string;
    const connectionId = event.requestContext.connectionId as string;
    const connectedAt = event.requestContext.connectedAt as number;
    const apiGatewayUrl = getApiGatewayUrl(event);
    const connectionInfo = { connectionId, connectedAt, apiGatewayUrl };

    switch (routeKey) {
      case WS_CONNECT:
        return onWsConnect(event);
      case WS_DISCONNECT:
        await kraken.onGqlConnectionTerminate(connectionInfo);
        return okResponse;
    }

    const operation = JSON.parse(event.body as string);
    switch (operation.type) {
      case GQL_CONNECTION_INIT:
        await kraken.onGqlInit(connectionInfo, operation);
        return okResponse;
      case GQL_START:
        await kraken.onGqlStart(connectionInfo, operation);
        return okResponse;
      case GQL_STOP:
        await kraken.onGqlStop(connectionInfo, operation);
        return okResponse;
      case GQL_CONNECTION_TERMINATE:
        await kraken.onGqlConnectionTerminate(connectionInfo);
        return okResponse;
    }

    return okResponse;
  };
};
