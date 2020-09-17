import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';
import { buildDocumentFromTypeDefinitions, makeExecutableSchema } from '@graphql-tools/schema';
import { execute, OperationDefinitionNode, parse } from 'graphql';
import { GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_DATA } from './constants';
import { PublishDirective } from './directives/publish-directive';
import { SubscribeDirective } from './directives/subscribe-directive';
import { krakenPubSub } from './pubsub';
import { ExecutionArgs, GqlOperation, Injector, KrakenRuntime, KrakenSchema } from './types';

type Config = KrakenSchema | KrakenSchema[]

export const pubsubTypeDefs = `
directive @pub(triggerName: String!) on FIELD_DEFINITION
directive @sub(triggerName: String) on FIELD_DEFINITION
`;

export const pubsubSchemaDirectives = {
  pub: PublishDirective,
  sub: SubscribeDirective
};

const corePlugins = (inject: Injector) => {
  inject('subMode', 'IN');
  inject('pubStrategy', 'GRAPHQL');
  inject('pubsub', krakenPubSub());
};

const defaultSchema: KrakenSchema = {
  typeDefs: buildDocumentFromTypeDefinitions([
    pubsubTypeDefs
  ]),
  resolvers: {},
  schemaTransforms: [],
  schemaDirectives: {
    ...pubsubSchemaDirectives
  }
};

const executionContextBuilder = ($plugins: Kraken.Plugins) =>
  <T>(ctx: T): T & Kraken.ExecutionContext => {
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
    return ctx as T & Kraken.ExecutionContext;
  };

const getResolvers = (schemaDefinition: KrakenSchema) => {
  if (!schemaDefinition.resolvers) return [];
  return Array.isArray(schemaDefinition.resolvers)
    ? schemaDefinition.resolvers
    : [schemaDefinition.resolvers];
};

export const krakenJs = <T>(config: Config): KrakenRuntime => {
  const configs = Array.isArray(config) ? config : [config];

  const $plugins = {} as Kraken.Plugins;
  const pluginInjector = (name, value) => $plugins['$' + name] = value;
  corePlugins(pluginInjector);

  const onConnectionInit: ((context) => Kraken.Context)[] = [];
  const onBeforeExecute: ((context, document) => void)[] = [];
  const onAfterExecute: ((context, response) => void)[] = [];

  const schemaDefinition = configs.reduce((result, each) => {
    if ('plugins' in each) each.plugins(pluginInjector);
    if ('onConnectionInit' in each) onConnectionInit.push(each.onConnectionInit);
    if ('onBeforeExecute' in each) onBeforeExecute.push(each.onBeforeExecute);
    if ('onAfterExecute' in each) onAfterExecute.push(each.onAfterExecute);

    if (each.typeDefs) {
      result.typeDefs = mergeTypeDefs([
        buildDocumentFromTypeDefinitions(result.typeDefs),
        buildDocumentFromTypeDefinitions(each.typeDefs)
      ]);
    }
    result.resolvers = mergeResolvers([
      ...getResolvers(result),
      ...getResolvers(each)
    ]);
    result.schemaDirectives = {
      ...result.schemaDirectives,
      ...each.schemaDirectives
    };
    result.directiveResolvers = {
      ...result.directiveResolvers,
      ...each.directiveResolvers
    };
    if (each.schemaTransforms) {
      result.schemaTransforms = [
        ...result.schemaTransforms,
        ...each.schemaTransforms
      ];
    }
    return result;
  }, defaultSchema);

  const executableSchema = makeExecutableSchema(schemaDefinition as any);
  const makeExecutionContext = executionContextBuilder($plugins);
  const $root = makeExecutionContext({});

  const gqlExecute = async (args: ExecutionArgs) => {
    const connection = await $root.$connections.get(args.connectionInfo.connectionId);
    const connectionContextValue = connection.context;
    const executionContextValue = args.contextValue;

    const $context = makeExecutionContext({
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
      if (fn) {
        const out = await fn($context, args.document);
        Object.assign($context, out);
      }
    }

    const response = await execute({
      ...args,
      contextValue: $context,
      schema: executableSchema
    });

    for (const fn of onAfterExecute) {
      if (fn) {
        await fn($context, response);
      }
    }

    return response;
  };

  const onGqlInit = async (connection: Kraken.ConnectionInfo, operation: GqlOperation<Kraken.InitParams>) => {
    const $context = makeExecutionContext({ connectionParams: operation.payload });

    const connectionContext = {};
    for (const fn of onConnectionInit) {
      if (fn) {
        const out = await fn($context);
        Object.assign(connectionContext, out);
      }
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

  return makeExecutionContext({
    schema: executableSchema,
    gqlExecute,
    onGqlInit,
    onGqlStart,
    onGqlStop,
    onGqlConnectionTerminate
  });
};
