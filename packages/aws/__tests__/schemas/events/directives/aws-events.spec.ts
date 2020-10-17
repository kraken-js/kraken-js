import { eventBridgeSchema } from '@kraken.js/aws';
import { krakenJs, KrakenSchema } from '@kraken.js/core';

const putEventsMock = jest.fn(() => ({
  promise: () => Promise.resolve()
}));

const setupKrakenRuntime = (testSchema: KrakenSchema) => krakenJs([
  eventBridgeSchema({
    eventBridge: {
      putEvents: putEventsMock
    } as any
  }),
  testSchema
]);

describe('@event', () => {
  it.each([
    [
      'mutation { analytics1(input: { data: "pageClick1" }) { data } }',
      {
        Detail: '{"data":"pageClick1"}',
        EventBusName: 'EventBus-test-stage',
        Source: 'analytics1'
      }
    ],
    [
      'mutation { analytics2(input: { data: "pageClick2" }) { data } }',
      {
        Detail: '{"data":"pageClick2"}',
        EventBusName: 'EventBus-test-stage',
        Source: 'analytics-2'
      }
    ],
    [
      'mutation { analytics3(input: { data: "pageClick3" }) { data } }',
      {
        Detail: '{"data":"pageClick3"}',
        EventBusName: 'EventBus-test-stage',
        Source: 'analytics-3',
        DetailType: 'graphql-event'
      }
    ]
  ])('should emit event with resolved response for %s', async (document, entry) => {
    const krakenRuntime = setupKrakenRuntime({
      typeDefs: `
        type Analytics { data: String }
        input AnalyticsInput { data: String }
        type Mutation { 
          analytics1(input: AnalyticsInput): Analytics @event
          analytics2(input: AnalyticsInput): Analytics @event(source: "analytics-2")
          analytics3(input: AnalyticsInput): Analytics @event(source: "analytics-3", type: "graphql-event")
        }
        type Query { _: String }
      `,
      resolvers: {
        Mutation: {
          analytics1: (_, args) => args.input,
          analytics2: (_, args) => args.input,
          analytics3: (_, args) => args.input
        }
      }
    });

    await krakenRuntime.gqlExecute({ operationId: '1', document });
    expect(putEventsMock).toHaveBeenCalledWith({ Entries: [entry] });
  });
});
