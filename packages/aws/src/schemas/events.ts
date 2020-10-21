import { Injector, KrakenSchema } from '@kraken.js/core';
import { AwsEventsSchemaConfig } from './events/config';
import { EventBridgeEventDirective } from './events/directives/aws-events';
import { eventBridgeEmitter } from './events/event-bridge-emitter';
// @ts-ignore
import * as typeDefs from './events/events.graphql';
import { getEventBridge } from './instances';

const schemaDirectives = {
  event: EventBridgeEventDirective
};

export const eventsSchema = (config?: AwsEventsSchemaConfig): KrakenSchema => ({
  typeDefs,
  schemaDirectives,
  plugins(inject: Injector) {
    inject('eventBridge', () => config?.eventBridge || getEventBridge(config?.eventBridgeConfig));
    inject('events', eventBridgeEmitter);
  }
});
