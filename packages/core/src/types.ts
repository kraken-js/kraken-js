import { IExecutableSchemaDefinition } from '@graphql-tools/schema';

export interface HandlerConfig<C extends Connection<T>, S extends Subscription, T = any>
  extends IExecutableSchemaDefinition<T> {
  context: ((payload: any) => T)

  validate?: boolean;

  connections: ConnectionManager<C, T>
  subscriptions: SubscriptionManager<S>
}

export interface Connection<T> {
  connectionId: string
  context: T
}

export interface Subscription {
  connectionId: string
  triggerName: string
  subscriptionId: string

  [key: string]: string
}

export interface PayloadMetadata {
  __typename?: string
  __created?: boolean
  __updated?: boolean
  __deleted?: boolean
  __timestamp?: number
}

export interface Payload {
  __metadata?: PayloadMetadata

  [key: string]: any
}

export interface ConnectionManager<C extends Connection<T>, T> {
  save(connection: Partial<C>): Promise<C>;

  get(connectionId: string, retries?: number): Promise<C>;

  delete(connection: Partial<C>): Promise<void>;

  send(connection: Partial<C>, payload: any): Promise<void>;
}

export interface SubscriptionManager<S extends Subscription> {
  subscribe(triggerName: string, options: Partial<S>): Promise<void>

  publish(triggerName: string, payload: Payload): Promise<void>

  unsubscribe(connectionId: string, subscriptionId: string): Promise<void>;

  unsubscribeAll(connectionId: string): Promise<void>;
}

