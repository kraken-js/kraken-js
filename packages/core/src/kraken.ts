import { IExecutableSchemaDefinition, makeExecutableSchema } from '@graphql-tools/schema';
import { execute, OperationDefinitionNode, parse } from 'graphql';
import { GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_DATA } from './constants';
import { PublishDirective } from './directives/publish-directive';
import { SubscribeDirective } from './directives/subscribe-directive';
import { krakenPubSub } from './pubsub';
import { ExecutionArgs, GqlOperation, KrakenRuntime, KrakenSchema } from './types';
import { pushToArray } from './utils';

export const pubsubTypeDefs = `
directive @pub(triggerName: String!) on FIELD_DEFINITION
directive @sub(triggerName: String) on FIELD_DEFINITION
`;
export const pubsubSchemaDirectives = {
  pub: PublishDirective,
  sub: SubscribeDirective
};

export const krakenIt = <T>(schemas: KrakenSchema | KrakenSchema[]): KrakenRuntime => {
  schemas = Array.isArray(schemas) ? schemas : [schemas];
  const schema: IExecutableSchemaDefinition<T> = {
    typeDefs: [
      pubsubTypeDefs
    ],
    resolvers: [],
    directiveResolvers: {},
    schemaDirectives: {
      ...pubsubSchemaDirectives
    },
    schemaTransforms: []
  };

  const plugins = [
    (inject) => inject('pubsub', krakenPubSub())
  ];
  const onConnectionInit: ((context) => Kraken.Context)[] = [];
  const onBeforeExecute: ((context, document) => void)[] = [];
  const onAfterExecute: ((context, response) => void)[] = [];

  schemas.forEach(each => {
    pushToArray(schema.resolvers, each.resolvers);
    pushToArray(schema.typeDefs, each.typeDefs);
    pushToArray(schema.schemaTransforms, each.schemaTransforms);

    schema.schemaDirectives = { ...schema.schemaDirectives, ...each.schemaDirectives };
    schema.directiveResolvers = { ...schema.directiveResolvers, ...each.directiveResolvers };

    each.plugins && plugins.push(each.plugins);
    each.onConnectionInit && onConnectionInit.push(each.onConnectionInit);
    each.onBeforeExecute && onBeforeExecute.push(each.onBeforeExecute);
    each.onAfterExecute && onAfterExecute.push(each.onAfterExecute);
  });

  const $plugins = {} as Kraken.Plugins;
  plugins.forEach(plugin => {
    plugin((name, value) => {
      $plugins['$' + name] = value;
    });
  });

  const assignPlugins = ctx => {
    Object.getOwnPropertyNames($plugins).forEach(plugin => {
      const $ = { [plugin]: $plugins[plugin] };
      Object.defineProperty(ctx, plugin, {
        get: () => {
          if (typeof $[plugin] === 'function') {
            $[plugin] = $[plugin](ctx);
          }
          return $[plugin];
        }
      });
    });
    return Object.seal(ctx);
  };

  const executableSchema = makeExecutableSchema(schema);
  const gqlExecute = async (args: ExecutionArgs) => {
    const executionContextValue = args.contextValue;
    const connection = await $plugins.$connections.get(args.connectionInfo.connectionId);

    const connectionContextValue = connection.context;
    const contextValue = assignPlugins({
      ...connectionContextValue,
      ...executionContextValue,
      connectionInfo: args.connectionInfo,
      operation: {
        id: args.operationId,
        document: args.document,
        operationName: args.operationName,
        variableValues: args.variableValues
      },
      gqlExecute
    });

    for (const fn of onBeforeExecute) {
      const out = await fn(contextValue, args.document);
      Object.assign(contextValue, out);
    }

    const response = execute({
      ...args,
      contextValue,
      schema: executableSchema
    });

    for (const fn of onAfterExecute) {
      await fn(contextValue, response);
    }

    return response;
  };

  const onGqlInit = async (connection: Kraken.ConnectionInfo, operation: GqlOperation<Kraken.InitParams>) => {
    const context = {};
    const onConnectionInitParams = { ...$plugins, connectionParams: operation.payload };
    for (const fn of onConnectionInit) {
      const out = await fn(onConnectionInitParams);
      Object.assign(context, out);
    }

    await $plugins.$connections.save({ ...connection, context });
    await $plugins.$connections.send(connection, { type: GQL_CONNECTION_ACK });
    return context;
  };

  const onGqlStart = async (connection: Kraken.ConnectionInfo, operation: GqlOperation) => {
    const document = parse(operation.payload.query as string);
    const variableValues = operation.payload.variables;
    const operationId = operation.id;
    const response = await gqlExecute({
      connectionInfo: connection,
      operationId,
      document,
      variableValues
    });

    // only send response if not subscription request, to avoid sending null response on subscribe initial message
    const operationDefinition = document.definitions[0] as OperationDefinitionNode;
    if (operationDefinition.operation !== 'subscription') {
      await $plugins.$connections.send(connection, {
        id: operationId,
        type: GQL_DATA,
        payload: response
      });
      await $plugins.$connections.send(connection, {
        id: operationId,
        type: GQL_COMPLETE
      });
    }
  };

  const onGqlStop = async (connection: Kraken.ConnectionInfo, operation: GqlOperation) => {
    await Promise.all([
      $plugins.$connections.send(connection, { id: operation.id, type: GQL_COMPLETE }),
      $plugins.$subscriptions.delete(connection.connectionId, operation.id)
    ]);
  };

  const onGqlConnectionTerminate = async (connection: Kraken.ConnectionInfo) => {
    await Promise.all([
      $plugins.$connections.delete(connection),
      $plugins.$subscriptions.deleteAll(connection.connectionId)
    ]);
  };

  return assignPlugins({
    schema: executableSchema,
    gqlExecute,
    onGqlInit,
    onGqlStart,
    onGqlStop,
    onGqlConnectionTerminate
  });
};
