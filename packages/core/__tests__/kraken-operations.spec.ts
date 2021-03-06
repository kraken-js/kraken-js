import { GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_DATA, KrakenConfig, krakenJs, KrakenSchema } from '@kraken.js/core';
import { mockRootPlugins } from './utils';

describe('Kraken Operations', () => {
  const connectionInfo = () => ({
    connectionId: Math.random().toString(32).slice(2)
  });

  const asIsPubStrategy: KrakenSchema = {
    plugins: (injector) => {
      injector('pubStrategy', 'AS_IS');
    }
  };

  const graphqlPubStrategy: KrakenSchema = {
    plugins: (injector) => {
      injector('pubStrategy', 'GRAPHQL');
    }
  };

  const broadcasterPubStrategy: KrakenSchema = {
    plugins: (inject => {
      const broadcast = jest.fn();
      inject('pubStrategy', 'BROADCASTER');
      inject('broadcaster', { broadcast });
    })
  };

  const setup = (extraSchemas: KrakenSchema[], config?: KrakenConfig) => {
    return krakenJs([
      { plugins: mockRootPlugins },
      {
        typeDefs: [`
        type Query {
          _: String
        }
        type Mutation {
          sendMessage(channel: String, message: String): Message @pub(triggerNames: ["onMessage#{channel}"])
          sendText(text: String): String @pub(triggerNames: ["onText"])
        }
        type Subscription {
          onMessage(channel: String): Message @sub(triggerName: "onMessage#{channel}")
          onText: String @sub(triggerName: "onText")
        }
        type Message {
          channel: String
          message: String
        }`
        ],
        resolvers: {
          Mutation: {
            sendMessage: (source, args) => args,
            sendText: (source, args) => args.text
          }
        }
      },
      ...extraSchemas
    ], config);
  };

  it.each([
    ['AS_IS', asIsPubStrategy, {
      channel: 'random', message: 'DOES IT WORKS?'
    }],
    ['GRAPHQL', graphqlPubStrategy, {
      __typename: 'Message', channel: 'random', message: 'DOES IT WORKS?', resolvedOnly: 'IT WORKS'
    }]
  ])('should really run GRAPHQL compared to AS_IS (round %s)', async (_, pubStrategy, onMessage) => {
    const extraSchema = {
      typeDefs: `extend type Message { resolvedOnly: String }`,
      resolvers: {
        Message: { resolvedOnly: () => 'IT WORKS' }
      }
    };

    const kraken = setup([pubStrategy, extraSchema], { batchResponses: true });
    const connection = connectionInfo();

    await kraken.onGqlInit(connection, {
      type: 'connection_init',
      payload: {}
    });
    await kraken.onGqlStart(connection, {
      id: '1',
      type: 'start',
      payload: { query: 'subscription { onMessage(channel: "random") { __typename channel message resolvedOnly } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '2',
      type: 'start',
      payload: { query: 'mutation { sendMessage(channel: "random", message: "DOES IT WORKS?") { channel message } }' }
    });

    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '1',
      type: GQL_DATA,
      payload: { data: { onMessage } }
    });
  });

  it('should not add __typename to raw fields', async () => {
    const kraken = setup([asIsPubStrategy], { batchResponses: true });
    const connection = connectionInfo();

    await kraken.onGqlInit(connection, {
      type: 'connection_init',
      payload: {}
    });
    await kraken.onGqlStart(connection, {
      id: '1',
      type: 'start',
      payload: { query: 'subscription { onText }' }
    });
    await kraken.onGqlStart(connection, {
      id: '2',
      type: 'start',
      payload: { query: 'mutation { sendText(text: "hello world") }' }
    });

    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '1',
      type: GQL_DATA,
      payload: { data: { onText: 'hello world' } }
    });
  });

  it('should not batch responses by default', async () => {
    const kraken = setup([]);
    const connection = connectionInfo();

    await kraken.onGqlInit(connection, {
      type: 'connection_init',
      payload: {}
    });
    await kraken.onGqlStart(connection, {
      id: '2',
      type: 'start',
      payload: { query: 'mutation { sendMessage(channel: "general", message: "hi") { channel message } }' }
    });

    expect(kraken.$connections.send).toHaveBeenCalledTimes(3);
    // connection accepted
    expect(kraken.$connections.send).toHaveBeenCalledWith(connection, {
      type: GQL_CONNECTION_ACK
    });
    // mutation response (not batched)
    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '2',
      type: GQL_DATA,
      payload: { data: { sendMessage: { channel: 'general', message: 'hi' } } }
    });
    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '2',
      type: GQL_COMPLETE
    });
  });

  it('should execute successfully full cycle operations using BROADCASTER strategy', async () => {
    const kraken = setup([broadcasterPubStrategy], { batchResponses: true });
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
      payload: { query: 'mutation { sendMessage(channel: "general", message: "hi") { channel message } }' }
    });

    expect(kraken.$connections.send).toHaveBeenCalledTimes(2);
    // connection accepted
    expect(kraken.$connections.send).toHaveBeenCalledWith(connection, {
      type: GQL_CONNECTION_ACK
    });
    // mutation response
    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), [{
      id: '2',
      type: GQL_DATA,
      payload: { data: { sendMessage: { channel: 'general', message: 'hi' } } }
    }, {
      id: '2',
      type: GQL_COMPLETE
    }]);

    expect(kraken.$broadcaster.broadcast).toHaveBeenCalledWith('onMessage#{channel}', {
      channel: 'general',
      message: 'hi'
    });
  });

  it.each([
    ['AS_IS', asIsPubStrategy],
    ['GRAPHQL', graphqlPubStrategy]
  ])('should execute successfully full cycle operations using %s strategy',
    async (_: Kraken.PublishingStrategy, pubStrategy: KrakenSchema) => {
      const kraken = setup([pubStrategy], { batchResponses: true });
      const connection = connectionInfo();
      const numOfSubscriptions = 111;

      await kraken.onGqlInit(connection, {
        type: 'connection_init',
        payload: {}
      });
      for (let i = 0; i < numOfSubscriptions; i++) {
        await kraken.onGqlStart(connection, {
          id: 's' + i,
          type: 'start',
          payload: { query: 'subscription { onMessage(channel: "general") { channel message } }' }
        });
      }
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
        type: 'stop', id: '2'
      });
      await kraken.onGqlConnectionTerminate(connection);

      // connection accepted
      expect(kraken.$connections.send).toHaveBeenCalledWith(connection, {
        type: GQL_CONNECTION_ACK
      });

      // publish to general channel
      for (let i = 0; i < numOfSubscriptions; i++) {
        expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
          id: 's' + i,
          type: GQL_DATA,
          payload: { data: { onMessage: { channel: 'general', message: 'hi' } } }
        });
      }
      // not publish to random channel
      expect(kraken.$connections.send).not.toHaveBeenCalledWith(expect.objectContaining(connection), {
        id: '2',
        type: GQL_DATA,
        payload: { data: { onMessage: { channel: expect.any(String), message: 'hi' } } }
      });
      // mutation response
      expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), [{
        id: '3',
        type: GQL_DATA,
        payload: { data: { sendMessage: { channel: 'general', message: 'hi' } } }
      }, {
        id: '3',
        type: GQL_COMPLETE
      }]);
      // stop subscription
      expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
        id: '2',
        type: GQL_COMPLETE
      });
    });

  it('should publish with specific publishing strategy', async () => {
    const extraSchema = {
      typeDefs: `
      extend type Mutation {
        publish(id: ID!): DifferentResponses @pub(triggerNames: ["pubGraphql#{id}", "pubAsIs#{id}"])
      }
      extend type Subscription {
        pubGraphql(id: ID!): DifferentResponses @sub(triggerName: "pubGraphql#{id}")
        pubAsIs(id: ID!): DifferentResponses @sub(triggerName: "pubAsIs#{id}")
      }
      type DifferentResponses {
        id: ID!
        resolvedOnly: String
      }`,
      resolvers: {
        Mutation: {
          publish: (_, args) => args
        },
        DifferentResponses: {
          resolvedOnly: () => 'graphql resolved'
        }
      },
      plugins(injector) {
        injector('pubStrategy', {
          pubGraphql: 'GRAPHQL',
          pubAsIs: 'AS_IS'
        });
      }
    };

    const kraken = setup([extraSchema], { batchResponses: true });
    const connection = connectionInfo();

    await kraken.onGqlInit(connection, {
      type: 'connection_init',
      payload: {}
    });
    await kraken.onGqlStart(connection, {
      id: '1',
      type: 'start',
      payload: { query: 'subscription { pubGraphql(id: "666") { id resolvedOnly } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '2',
      type: 'start',
      payload: { query: 'subscription { pubAsIs(id: "666") { id resolvedOnly } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '3',
      type: 'start',
      payload: { query: 'mutation { publish(id: "666") { id resolvedOnly } }' }
    });

    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '1',
      type: GQL_DATA,
      payload: {
        data: { pubGraphql: { id: '666', resolvedOnly: 'graphql resolved' } }
      }
    });
    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '2',
      type: GQL_DATA,
      payload: {
        data: { pubAsIs: { id: '666' } }
      }
    });
  });

  it('should allow filtering and modifying the message on subscribe field resolver', async () => {
    const extraSchema = {
      resolvers: {
        Subscription: {
          onMessage: ({
            subscribe(source, args, context, info) {
              if (args.channel === 'shall-not-pass') {
                return null;
              }
              return {
                ...source[info.fieldName],
                message: 'customized message'
              };
            }
          })
        }
      }
    };

    const kraken = setup([extraSchema], { batchResponses: true });
    const connection = connectionInfo();

    await kraken.onGqlInit(connection, {
      type: 'connection_init',
      payload: {}
    });
    await kraken.onGqlStart(connection, {
      id: '1.1',
      type: 'start',
      payload: { query: 'subscription { onMessage(channel: "octopus") { channel message } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '1.2',
      type: 'start',
      payload: { query: 'mutation { sendMessage(channel: "octopus", message: "original message") { channel } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '2.1',
      type: 'start',
      payload: { query: 'subscription { onMessage(channel: "shall-not-pass") { channel message } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '2.2',
      type: 'start',
      payload: { query: 'mutation { sendMessage(channel: "shall-not-pass", message: "shall I?") { channel } }' }
    });

    // connection init, mutation 1 + completed, mutation 2 + completed, subscription 1.1 response (not subscription 2.1)
    expect(kraken.$connections.send).toHaveBeenCalledTimes(4);
    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '1.1',
      type: GQL_DATA,
      payload: {
        data: { onMessage: { channel: 'octopus', message: 'customized message' } }
      }
    });
    expect(kraken.$connections.send).not.toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '2.1',
      type: GQL_DATA,
      payload: expect.anything()
    });
  });

  it('should publish data including metadata', async () => {
    const metadata = { __timestamp: Date.now(), __updated: true };
    const extraSchema = {
      typeDefs: `
      extend type Mutation {
        publishWithMeta(id: ID!): Item @pub(triggerNames: ["onItem#{id}"])
      }
      extend type Subscription {
        onItem(id: ID!): Item @sub(triggerName: "onItem#{id}")
      }
      type Item {
        id: ID!
      }`,
      resolvers: {
        Mutation: {
          publishWithMeta: (_, args) => {
            return { ...args, ...metadata };
          }
        }
      }
    };

    const kraken = setup([extraSchema], { batchResponses: true });
    const connection = connectionInfo();

    await kraken.onGqlInit(connection, {
      type: 'connection_init',
      payload: {}
    });
    await kraken.onGqlStart(connection, {
      id: '1',
      type: 'start',
      payload: { query: 'subscription { onItem(id: "666") { id } }' }
    });
    await kraken.onGqlStart(connection, {
      id: '3',
      type: 'start',
      payload: { query: 'mutation { publishWithMeta(id: "666") { id } }' }
    });

    expect(kraken.$connections.send).toHaveBeenCalledWith(expect.objectContaining(connection), {
      id: '1',
      type: GQL_DATA,
      payload: {
        data: { onItem: { id: '666', ...metadata } }
      }
    });
  });
});
