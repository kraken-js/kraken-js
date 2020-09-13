import { GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_DATA, krakenIt } from '@kraken.js/core';
import { rootPlugins } from './utils';

describe('Kraken Operations', () => {
  const connectionInfo = () => ({
    connectionId: Math.random().toString(32).slice(2)
  });

  const setup = () => {
    return krakenIt([{
      plugins: rootPlugins
    }, {
      typeDefs: [`
        type Query {
          _: String
        }
        type Mutation {
          sendMessage(channel: String, message: String): Message @pub(triggerName: "onMessage#{channel}")
        }
        type Subscription {
          onMessage(channel: String): Message @sub(triggerName: "onMessage#{channel}")
        }
        type Message {
          channel: String
          message: String
        }`
      ],
      resolvers: {
        Mutation: {
          sendMessage: (source, args) => args
        }
      }
    }]);
  };

  it('should execute successfully full cycle operations (start, subscribe, mutate, stop, terminate)', async () => {
    const kraken = setup();
    const connection = connectionInfo();

    await kraken.onGqlInit(connection, {
      type: 'connection_init',
      payload: {}
    });
    await kraken.onGqlStart(connection, {
      id: '1',
      type: 'start',
      payload: { query: 'subscription { onMessage(channel: "general") { channel message } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '2',
      type: 'start',
      payload: { query: 'subscription { onMessage(channel: "random") { channel message } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '3',
      type: 'start',
      payload: { query: 'mutation { sendMessage(channel: "general", message: "hi") { channel message } }' }
    });
    await kraken.onGqlStop(connection, {
      type: 'stop', id: '1'
    });
    await kraken.onGqlConnectionTerminate(connection);

    expect(kraken.$connections.send).toHaveBeenNthCalledWith(1, connection, {
      type: GQL_CONNECTION_ACK
    });
    expect(kraken.$connections.send).toHaveBeenNthCalledWith(2, expect.objectContaining(connection), {
      id: '1',
      type: GQL_DATA,
      payload: { data: { onMessage: { __typename: 'Message', channel: 'general', message: 'hi' } } }
    });
    expect(kraken.$connections.send).toHaveBeenNthCalledWith(3, expect.objectContaining(connection), {
      id: '3',
      type: GQL_DATA,
      payload: { data: { sendMessage: { channel: 'general', message: 'hi' } } }
    });
    expect(kraken.$connections.send).toHaveBeenNthCalledWith(4, expect.objectContaining(connection), {
      id: '3',
      type: GQL_COMPLETE
    });
  });
});
