import { GQL_COMPLETE, GQL_CONNECTION_ACK, GQL_DATA } from '@kraken.js/core';
import gql from 'graphql-tag';
import { mockWsHandler } from './utils';

describe('AWS Websocket Handler', () => {
  it.each([
    ['c1', undefined, undefined],
    ['c2', null, null],
    ['c3', {}, ''],
    ['c4', { key: 'value' }, 'ws-graphql']
  ])('should reply to connect connection "%s" with params %s and protocol "%s"', async (connectionId, params, protocol) => {
    const { connect } = mockWsHandler({ typeDefs: gql('type Query { _: String }') });
    const actual = await connect(connectionId, params, protocol);
    expect(actual).toEqual({
      statusCode: 200,
      headers: { 'Sec-WebSocket-Protocol': protocol },
      body: ''
    });
  });

  it('should initialize connection, save it and reply with connection_ack', async () => {
    const { connect, invoke, connections } = mockWsHandler({
      typeDefs: gql('type Query { _: String }')
    });

    await connect('c1', null);
    await invoke({ id: 1, type: 'connection_init' });

    const connection = {
      apiGatewayUrl: 'https://domain.fake/test',
      connectedAt: expect.any(Number),
      connectionId: 'c1',
      context: {}
    };
    expect(connections.save).toHaveBeenCalledWith(connection);
    expect(connections.send).toHaveBeenCalledWith(connection, { type: GQL_CONNECTION_ACK });
  });

  it('should execute operation and send data to connection with response and complete response', async () => {
    const { connect, invoke, operation, connections } = mockWsHandler({
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: () => 'hello world' } }
    });

    await connect('c2', null);
    await invoke({ id: 1, type: 'connection_init' });
    await operation({ id: 2, type: 'start', query: 'query { hello }' });

    expect(connections.send).toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c2'
    }), {
      id: 2,
      type: GQL_DATA,
      payload: { data: { hello: 'hello world' } }
    });
    expect(connections.send).toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c2'
    }), {
      id: 2,
      type: GQL_COMPLETE
    });
  });

  it('should remove subscription on connection terminate', async () => {
    const { connect, invoke, disconnect, operation, connections, subscriptions } = mockWsHandler({
      typeDefs: gql('type Query { _: String }')
    });

    await connect('c0', null);
    await invoke({ id: 1, type: 'connection_init' });
    await disconnect();

    expect(connections.delete).toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c0'
    }));
    expect(subscriptions.unsubscribeAll).toHaveBeenCalledWith('c0');
  });

  it('should remove subscription on operation stop', async () => {
    const { connect, invoke, operation, connections, subscriptions } = mockWsHandler({
      typeDefs: gql('type Query { _: String } type Subscription { onMessage: String }'),
      resolvers: { Subscription: { onMessage: () => 'hello world' } }
    });

    await connect('c3', null);
    await invoke({ id: 1, type: 'connection_init' });
    await operation({ id: 2, type: 'start', query: 'subscription { onMessage }' });
    await operation({ id: 2, type: 'stop' });

    expect(connections.send).not.toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c3'
    }), expect.objectContaining({
      id: 2,
      type: GQL_DATA
    }));

    expect(subscriptions.unsubscribe).toHaveBeenCalledWith('c3', 2);
    expect(connections.send).toHaveBeenCalledWith(expect.objectContaining({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c3'
    }), {
      id: 2,
      type: GQL_COMPLETE
    });
  });

  it('should remove connection and all subscriptions on connection_terminate', async () => {
    const { connect, invoke, operation, connections, subscriptions } = mockWsHandler({
      typeDefs: gql('type Query { _: String }')
    });

    await connect('c4', null);
    await invoke({ id: 1, type: 'connection_init' });
    await operation({ id: 2, type: 'connection_terminate' });

    expect(connections.delete).toHaveBeenCalledWith({
      apiGatewayUrl: 'https://domain.fake/test',
      connectionId: 'c4'
    });
    expect(subscriptions.unsubscribeAll).toHaveBeenCalledWith('c4');
  });
});
