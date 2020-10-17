import { eventBridgeEmitter } from '@kraken.js/aws/src/schemas/events/event-bridge-emitter';

const $context = {
  $eventBridge: {
    putEvents: jest.fn(() => ({
      promise() {
        return Promise.resolve();
      }
    }))
  }
};

describe('Event Bridge Emitter', () => {
  it('should emit single event', async () => {
    const payload = { shallPass: true };
    await eventBridgeEmitter($context)
      .source('@kraken.js')
      .type('test.unit')
      .event(payload)
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

  it('should emit single event to different event bus', async () => {
    const payload = { customEventBus: true };
    await eventBridgeEmitter($context)
      .eventBus('custom-event-bus')
      .source('@kraken.js')
      .type('test.unit.custom-event-bus')
      .event(payload)
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
      .source('@kraken.js')
      .type('test.unit')
      .event(payload1)
      .event(payload2)
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
});
