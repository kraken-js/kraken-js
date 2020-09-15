import { IExecutableSchemaDefinition, makeExecutableSchema } from '@graphql-tools/schema';
import { execute, OperationDefinitionNode, parse } from 'graphql';
import { GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_DATA } from './constants';
import { PublishDirective } from './directives/publish-directive';
import { SubscribeDirective } from './directives/subscribe-directive';
import { krakenPubSub } from './pubsub';
import { ExecutionArgs, GqlOperation, Injector, KrakenRuntime, KrakenSchema } from './types';
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
    (inject: Injector) => {
      inject('subMode', 'IN');
      inject('pubStrategy', 'GRAPHQL');
      inject('pubsub', krakenPubSub());
    }
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

  const createExecutionContext = ctx => {
    Object.getOwnPropertyNames($plugins).forEach(plugin => {
      const $ = { [plugin]: $plugins[plugin] };
      if (ctx[plugin] === undefined) {
        Object.defineProperty(ctx, plugin, {
          get() {
            if (typeof $[plugin] === 'function') {
              $[plugin] = $[plugin](ctx);
            }
            return $[plugin];
          }
        });
      }
    });
    return Object.seal(ctx);
  };

  const $root = createExecutionContext({});
  const executableSchema = makeExecutableSchema(schema);

  const gqlExecute = async (args: ExecutionArgs) => {
    const connection = await $root.$connections.get(args.connectionInfo.connectionId);
    const connectionContextValue = connection.context;
    const executionContextValue = args.contextValue;

    const $context = createExecutionContext({
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
      const out = await fn($context, args.document);
      Object.assign($context, out);
    }

    const response = await execute({
      ...args,
      contextValue: $context,
      schema: executableSchema
    });

    for (const fn of onAfterExecute) {
      await fn($context, response);
    }

    return response;
  };

  const onGqlInit = async (connection: Kraken.ConnectionInfo, operation: GqlOperation<Kraken.InitParams>) => {
    const $context = createExecutionContext({ connectionParams: operation.payload });

    const connectionContext = {};
    for (const fn of onConnectionInit) {
      const out = await fn($context);
      Object.assign(connectionContext, out);
    }

    await $context.$connections.save({ ...connection, context: connectionContext });
    await $context.$connections.send(connection, { type: GQL_CONNECTION_ACK });
    return $context;
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
      await $root.$connections.send(connection, {
        id: operationId,
        type: GQL_DATA,
        payload: response
      });
      await $root.$connections.send(connection, {
        id: operationId,
        type: GQL_COMPLETE
      });
    }
  };

  const onGqlStop = async (connection: Kraken.ConnectionInfo, operation: GqlOperation) => {
    await Promise.all([
      $root.$connections.send(connection, { id: operation.id, type: GQL_COMPLETE }),
      $root.$subscriptions.delete(connection.connectionId, operation.id)
    ]);
  };

  const onGqlConnectionTerminate = async (connection: Kraken.ConnectionInfo) => {
    await Promise.all([
      $root.$connections.delete(connection),
      $root.$subscriptions.deleteAll(connection.connectionId)
    ]);
  };

  return createExecutionContext({
    schema: executableSchema,
    gqlExecute,
    onGqlInit,
    onGqlStart,
    onGqlStop,
    onGqlConnectionTerminate
  });
};
