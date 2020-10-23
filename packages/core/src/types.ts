import { IExecutableSchemaDefinition } from '@graphql-tools/schema';
import { DocumentNode, ExecutionResult, GraphQLSchema } from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue';

export interface Payload {
  [key: string]: any
}

export interface ConnectionStore {
  save(connection: Partial<Kraken.Connection>): Promise<Kraken.Connection>;

  get(connectionId: string, retries?: number): Promise<Kraken.Connection>;

  delete(connection: Partial<Kraken.Connection>): Promise<void>;

  send(connection: Kraken.ConnectionInfo, payload: Payload): Promise<void>
}

export interface SubscriptionStore {
  save(subscription: Partial<Kraken.Subscription>): Promise<Kraken.Subscription>

  delete(connectionId: string, operationId: string): Promise<void>;

  deleteAll(connectionId: string): Promise<void>;

  findByTriggerName(triggerName: string): Promise<Kraken.Subscription[]>
}

export interface PubSub {
  subscribe(triggerName: string, vars?: Record<string, any>): Promise<Kraken.Subscription>

  publish(triggerName: string, payload: any): Promise<void>
}

export interface Broadcaster {
  broadcast(triggerName: string, payload: any)
}

export type Injector = (name: string, value: ((ctx: Kraken.ExecutionContext) => any) | any) => void;

export interface KrakenSchema extends Partial<IExecutableSchemaDefinition<Kraken.Context>> {

  plugins?(inject: Injector): void;

  onConnect?(context: Partial<Kraken.Context>): PromiseOrValue<Partial<Kraken.Context>>;

  onDisconnect?(connection: Kraken.ConnectionInfo): PromiseOrValue<any>;

  onBeforeExecute?(context: Kraken.Context, document: DocumentNode): PromiseOrValue<Partial<Kraken.Context>>;

  onAfterExecute?(context: Kraken.Context, response: ExecutionResult): PromiseOrValue<void>;
}

export interface ExecutionArgs {
  connectionInfo?: Kraken.ConnectionInfo,
  operationId: string,
  rootValue?: any;
  contextValue?: Partial<Kraken.Context>;
  document: DocumentNode | string;
  variableValues?: Maybe<{ [key: string]: any }>;
  operationName?: Maybe<string>;
}

export interface GqlOperationPayload {
  query: string
  variables?: Record<string, any>

  [key: string]: any
}

export interface GqlOperation<P = GqlOperationPayload> {
  id?: string
  type: string
  payload: P
}

declare global {
  namespace Kraken {
    interface InitParams {
      [key: string]: any
    }

    type PublishingStrategy = 'AS_IS' | 'GRAPHQL' | 'BROADCASTER';

    interface Context {
      $connections: ConnectionStore
      $subscriptions: SubscriptionStore
      $pubsub: PubSub
      $subMode?: 'IN' | 'OUT'
      $pubStrategy?: PublishingStrategy | Record<string, PublishingStrategy>
      $broadcaster?: Broadcaster
    }

    interface ConnectionInfo {
      connectionId: string
    }

    type ExecutionContext = Context & {
      connectionInfo?: ConnectionInfo
      operation?: {
        id: string
        document: DocumentNode
        operationName: string
        variableValues?: any
      }

      serialize(): Context
      gqlExecute(args: ExecutionArgs): Promise<ExecutionResult>;
    }


    interface Connection extends ConnectionInfo {
      context: Context

      [key: string]: any
    }

    interface Subscription extends ConnectionInfo {
      operationId: string
      triggerName: string
      document: string
      operationName: string
      variableValues?: any

      [key: string]: any
    }

    interface Runtime extends Kraken.Context {
      schema: GraphQLSchema;

      gqlExecute(args: ExecutionArgs): PromiseOrValue<ExecutionResult>;

      onGqlInit(connection: Kraken.ConnectionInfo, operation: Omit<GqlOperation<Kraken.InitParams>, 'id'>): PromiseOrValue<Kraken.Context>;

      onGqlStart(connection: Kraken.ConnectionInfo, operation: GqlOperation): PromiseOrValue<void>

      onGqlStop(connection: Kraken.ConnectionInfo, operation: Omit<GqlOperation, 'payload'>): PromiseOrValue<void>

      onGqlConnectionTerminate(connection: Kraken.ConnectionInfo): PromiseOrValue<void>

      onConnectionInit(operation: Omit<GqlOperation<Kraken.InitParams>, 'id'>): Promise<{ $context: Kraken.Context, contextValue: any }>
    }
  }
}
