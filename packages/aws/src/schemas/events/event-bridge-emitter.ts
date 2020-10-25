import { PutEventsRequestEntryList, PutEventsResponse } from 'aws-sdk/clients/eventbridge';

export type EventBridgeEmitter = {
  eventBus(eventBus): EventBridgeEmitter
  source(source: string): EventBridgeEmitter
  type(type: string): EventBridgeEmitter
  event(payload: any): EventBridgeEmitter
  send(): Promise<PutEventsResponse>
}

export const eventBridgeEmitter = ({ $eventBridge }: Kraken.Context): EventBridgeEmitter => {
  const entries: PutEventsRequestEntryList = [];
  const metadata = {
    eventBus: process.env.EVENT_BUS_NAME as string,
    source: undefined,
    type: undefined
  };

  return {
    eventBus(eventBus) {
      metadata.eventBus = eventBus;
      return this;
    },
    source(source: string) {
      metadata.source = source;
      return this;
    },
    type(type: string) {
      metadata.type = type;
      return this;
    },
    event(payload: any) {
      entries.push({
        EventBusName: metadata.eventBus,
        Source: metadata.source,
        DetailType: metadata.type,
        Detail: JSON.stringify(payload)
      });
      return this;
    },
    async send() {
      return await $eventBridge.putEvents({
        Entries: entries
      }).promise();
    }
  };
};
