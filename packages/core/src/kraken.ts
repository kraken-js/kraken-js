import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';
import { buildDocumentFromTypeDefinitions, makeExecutableSchema } from '@graphql-tools/schema';
import { execute, OperationDefinitionNode, parse } from 'graphql';
import { GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_DATA } from './constants';
import { PublishDirective } from './directives/publish-directive';
import { SubscribeDirective } from './directives/subscribe-directive';
import { krakenPubSub } from './pubsub';
// @ts-ignore
import * as krakenTypesDefs from './schema.graphql';
import { ExecutionArgs, GqlOperation, Injector, KrakenRuntime, KrakenSchema } from './types';

type Config = KrakenSchema | KrakenSchema[]

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
  typeDefs: [
    krakenTypesDefs
  ],
  resolvers: {},
  schemaTransforms: [],
  schemaDirectives: {
    ...pubsubSchemaDirectives
  },
  logger: {
    log: error => console.error(error)
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

  const onConnect: ((context) => Kraken.Context)[] = [];
  const onBeforeExecute: ((context, document) => void)[] = [];
  const onAfterExecute: ((context, response) => void)[] = [];

  const schemaDefinition = configs.reduce((result, each) => {
    if ('plugins' in each) each.plugins(pluginInjector);
    if ('onConnect' in each) onConnect.push(each.onConnect);
    if ('onBeforeExecute' in each) onBeforeExecute.push(each.onBeforeExecute);
    if ('onAfterExecute' in each) onAfterExecute.push(each.onAfterExecute);

    if (each.typeDefs) {
      result.typeDefs = (result.typeDefs as Array<any>).concat(each.typeDefs);
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
  }, { ...defaultSchema });

  const executableSchema = makeExecutableSchema(schemaDefinition as any);
  const makeExecutionContext = executionContextBuilder($plugins);
  const $root = makeExecutionContext({});

  const onConnectionInit = async (operation: Pick<GqlOperation<Kraken.InitParams>, 'payload'>) => {
    const $context = makeExecutionContext({ connectionParams: operation.payload });
    const contextValue = {};
    for (const fn of onConnect) {
      if (fn) {
        const out = await fn($context);
        Object.assign(contextValue, out);
      }
    }
    return { $context, contextValue };
  };

  const gqlExecute = async (args: ExecutionArgs) => {
    const buildContext = async () => {
      const executionContextValue = args.contextValue;
      if (args.connectionInfo) {
        const connection = await $root.$connections.get(args.connectionInfo.connectionId);
        const connectionContextValue = connection?.context;
        return {
          ...connectionContextValue,
          ...executionContextValue,
          connectionInfo: args.connectionInfo
        };
      }
      return executionContextValue;
    };

    const executionContext = await buildContext();
    const $context = makeExecutionContext({
      ...executionContext,
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

    const document = (typeof args.document === 'string') ? parse(args.document) : args.document;
    const response = await execute({
      ...args,
      document,
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
    const { $context, contextValue } = await onConnectionInit(operation);

    await $context.$connections.save({ ...connection, context: contextValue });
    await $context.$connections.send(connection, { type: GQL_CONNECTION_ACK });
    return $context;
  };

  const onGqlStart = async (connection: Kraken.ConnectionInfo, operation: GqlOperation) => {
    const document = parse(operation.payload.query);
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
    onGqlConnectionTerminate,
    onConnectionInit
  }) as KrakenRuntime;
};
