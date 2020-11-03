import { PutEventsRequestEntryList } from 'aws-sdk/clients/eventbridge';

export interface PutEvent {
  eventBus?: string;
  source: string;
  type?: string;
  payload: any;
}

export type EventBridgeEmitter = {
  put(event: PutEvent): EventBridgeEmitter
  send(): Promise<void>
}

export const eventBridgeEmitter = ({ $eventBridge }: Kraken.Context): EventBridgeEmitter => {
  const defaultEvenBus = process.env.EVENT_BUS_NAME as string;
  const entries: PutEventsRequestEntryList = [];

  return {
    put({ eventBus = defaultEvenBus, source, type, payload }: PutEvent) {
      entries.push({
        EventBusName: eventBus,
        Source: source,
        DetailType: type || source,
        Detail: JSON.stringify(payload)
      });
      return this;
    },
    async send() {
      let batch = [];

      while (entries.length > 0) {
        batch.push(entries.shift());

        if (batch.length === 10) { // each 10 (max for event bridge)
          await $eventBridge.putEvents({ Entries: batch }).promise();
          batch = [];
        }
      }

      if (batch.length > 0) {
        await $eventBridge.putEvents({ Entries: batch }).promise();
      }
    }
  };
};
