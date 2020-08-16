import { APIGatewayProxyEvent } from 'aws-lambda';
import { execute, OperationDefinitionNode, parse } from 'graphql';
import { ConnectionManager, getOperationFromEvent } from './connection-manager';
import {
  deleteApiGatewayConnection,
  deleteConnection,
  deleteSubscription,
  getApiGatewayUrl,
  getConnection,
  postToConnection,
  putConnection
} from './connection-manager-aws-helpers';
import { GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_CONNECTION_TERMINATE, GQL_DATA } from './constants';

export class DynamoDbConnectionManager extends ConnectionManager {
  async wsConnect() {
  }

  async wsDisconnect(event: APIGatewayProxyEvent) {
    const connectionId = event.requestContext.connectionId as string;
    await deleteConnection(connectionId);
  }

  async gqlConnectionInit(event: APIGatewayProxyEvent) {
    const { payload } = getOperationFromEvent(event);
    const context = await this.graphQLModule.context(payload);
    const apiGatewayUrl = getApiGatewayUrl(event);
    const connection = {
      connectionId: event.requestContext.connectionId,
      connectedAt: event.requestContext.connectedAt,
      callbackUrl: apiGatewayUrl,
      context
    };
    await putConnection(connection);
    await postToConnection(event, { type: GQL_CONNECTION_ACK });
  }

  async gqlStart(event: APIGatewayProxyEvent) {
    const connectionId = event.requestContext.connectionId as string;
    const connection = await getConnection(connectionId).catch(async () => {
      const apiGatewayUrl = getApiGatewayUrl(event);
      await postToConnection(event, { type: GQL_CONNECTION_TERMINATE });
      await deleteConnection(connectionId);
      await deleteApiGatewayConnection(connectionId, apiGatewayUrl);
    });

    if (connection) {
      const operation = getOperationFromEvent(event);
      const context = {
        ...connection.context,
        requestTime: event.requestContext.requestTimeEpoch,
        connectionId: connection.connectionId,
        callbackUrl: connection.callbackUrl,
        subscriptionId: operation.id
      };

      const schema = this.graphQLModule.schema;
      const documentNode = parse(operation.payload.query as string);
      const response = await execute(
        schema,
        documentNode,
        null, // rootValue
        context,
        operation.payload.variables,
        operation.payload.operationName
      );

      // only send response if not subscription request, to avoid sending null response on subscribe initial message
      const operationDefinition = documentNode.definitions[0] as OperationDefinitionNode;
      if (operationDefinition.operation !== 'subscription') {
        await postToConnection(event, {
          id: operation.id,
          type: GQL_DATA,
          payload: response
        });
        await postToConnection(event, {
          id: operation.id,
          type: GQL_COMPLETE
        });
      }
    }
  }

  async gqlStop(event: APIGatewayProxyEvent) {
    const { id } = getOperationFromEvent(event);
    const connectionId = event.requestContext.connectionId as string;
    await postToConnection(event, { id, type: GQL_COMPLETE });
    await deleteSubscription(connectionId, id);
  }

  async gqlConnectionTerminate(event: APIGatewayProxyEvent) {
    const connectionId = event.requestContext.connectionId;
    const apiGatewayUrl = getApiGatewayUrl(event);
    await deleteConnection(connectionId);
    await deleteApiGatewayConnection(connectionId, apiGatewayUrl);
  }
}
