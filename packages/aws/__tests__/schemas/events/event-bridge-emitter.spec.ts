import { eventBridgeEmitter } from '@kraken.js/aws/src/schemas/events/event-bridge-emitter';

const $context = {
  $eventBridge: {
    putEvents: jest.fn(() => ({
      promise() {
        return Promise.resolve();
      }
    })) as any
  }
};

describe('Event Bridge Emitter', () => {
  it('should emit single event', async () => {
    const payload = { shallPass: true };
    await eventBridgeEmitter($context)
      .put({ source: '@kraken.js', type: 'test.unit', payload })
      .send();

    expect($context.$eventBridge.putEvents).toHaveBeenCalledWith({
      Entries: [{
        EventBusName: process.env.EVENT_BUS_NAME,
        Source: '@kraken.js',
        DetailType: 'test.unit',
        Detail: JSON.stringify(payload)
      }]
    });
  });

  it('should emit event and clean queue', async () => {
    await eventBridgeEmitter($context)
      .put({ source: '@kraken.js', type: 'test.unit', payload: { a: 1 } })
      .send();
    await eventBridgeEmitter($context)
      .put({ source: '@kraken.js', type: 'test.unit', payload: { a: 2 } })
      .send();

    expect($context.$eventBridge.putEvents).toHaveBeenCalledTimes(2);
    expect($context.$eventBridge.putEvents).toHaveBeenNthCalledWith(1, {
      Entries: [{
        EventBusName: process.env.EVENT_BUS_NAME,
        Source: '@kraken.js',
        DetailType: 'test.unit',
        Detail: JSON.stringify({ a: 1 })
      }]
    });
    expect($context.$eventBridge.putEvents).toHaveBeenNthCalledWith(2, {
      Entries: [{
        EventBusName: process.env.EVENT_BUS_NAME,
        Source: '@kraken.js',
        DetailType: 'test.unit',
        Detail: JSON.stringify({ a: 2 })
      }]
    });
  });

  it('should emit single event to different event bus', async () => {
    const payload = { customEventBus: true };
    await eventBridgeEmitter($context)
      .put({ eventBus: 'custom-event-bus', source: '@kraken.js', type: 'test.unit.custom-event-bus', payload })
      .send();

    expect($context.$eventBridge.putEvents).toHaveBeenCalledWith({
      Entries: [{
        EventBusName: 'custom-event-bus',
        Source: '@kraken.js',
        DetailType: 'test.unit.custom-event-bus',
        Detail: JSON.stringify(payload)
      }]
    });
  });

  it('should emit multiple event', async () => {
    const payload1 = { shallPass: true, id: 11 };
    const payload2 = { shallPass: true, id: 22 };
    await eventBridgeEmitter($context)
      .put({ source: '@kraken.js', type: 'test.unit', payload: payload1 })
      .put({ source: '@kraken.js', type: 'test.unit', payload: payload2 })
      .send();

    expect($context.$eventBridge.putEvents).toHaveBeenCalledWith({
      Entries: [{
        EventBusName: process.env.EVENT_BUS_NAME,
        Source: '@kraken.js',
        DetailType: 'test.unit',
        Detail: JSON.stringify(payload1)
      },
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: '@kraken.js',
          DetailType: 'test.unit',
          Detail: JSON.stringify(payload2)
        }]
    });
  });

  it('should emit batch of event', async () => {
    const emitter = eventBridgeEmitter($context);

    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 10; i++) {
        emitter.put({ source: '@kraken.js', type: 'test.unit', payload: { i, j } });
      }
    }

    await emitter.send();

    for (let j = 0; j < 10; j++) {
      const entries = [];
      for (let i = 0; i < 10; i++) {
        entries.push({
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: '@kraken.js',
          DetailType: 'test.unit',
          Detail: JSON.stringify({ i, j })
        });
      }
      expect($context.$eventBridge.putEvents).toHaveBeenNthCalledWith(j + 1, { Entries: entries });
    }
  });
});
