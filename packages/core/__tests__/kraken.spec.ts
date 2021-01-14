import { krakenJs } from '@kraken.js/core';
import { GraphQLError, parse } from 'graphql';
import gql from 'graphql-tag';
import { mockRootPlugins } from './utils';

describe('Kraken', () => {
  const gqlInitOperation = { type: 'connection_init', payload: {} as any };
  const connectionId = Math.random().toString(8);
  const operationId = Math.random().toString(8);
  const connectionInfo = { connectionId };

  it('should execute simple graphql operation', async () => {
    const { gqlExecute, onGqlInit } = krakenJs({
      plugins: mockRootPlugins,
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: () => 'hello world' } }
    });

    await onGqlInit({ connectionId }, gqlInitOperation);
    const response = await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });
    expect(response).toEqual({ data: { hello: 'hello world' } });
  });

  it('should execute simple graphql operation (with error)', async () => {
    const { gqlExecute, onGqlInit } = krakenJs({
      plugins: mockRootPlugins,
      typeDefs: gql('type Query { error: String }'),
      resolvers: {
        Query: {
          error: () => {
            throw new GraphQLError('error');
          }
        }
      }
    });

    await onGqlInit({ connectionId }, gqlInitOperation);
    const response = await gqlExecute({ connectionInfo, operationId, document: parse('query { error }') });
    expect(response).toEqual({
      data: { error: null },
      errors: [new GraphQLError('error')]
    });
  });

  it('should execute merged graphql operation', async () => {
    const { gqlExecute, onGqlInit } = krakenJs([{
      plugins: mockRootPlugins
    }, {
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: () => 'hello world 1' } }
    }, {
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: () => 'hello world 2' } }
    }]);

    await onGqlInit({ connectionId }, gqlInitOperation);
    const response = await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });
    expect(response).toEqual({ data: { hello: 'hello world 2' } });
  });

  it('should execute call onBeforeExecute before each execution', async () => {
    const onBeforeExecute = jest.fn();

    const { gqlExecute, onGqlInit } = krakenJs({
      plugins: mockRootPlugins,
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: () => 'hello world' } },
      onBeforeExecute
    });

    await onGqlInit({ connectionId }, gqlInitOperation);
    await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });
    await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });

    expect(onBeforeExecute).toHaveBeenCalledTimes(2);
    expect(onBeforeExecute).toHaveBeenCalledWith(expect.objectContaining({
      $connections: expect.anything(),
      connectionInfo,
      operation: expect.objectContaining({
        id: operationId,
        document: expect.objectContaining({
          definitions: expect.anything()
        })
      })
    }), expect.objectContaining({ definitions: expect.anything() }));
  });

  it('should execute call onAfterExecute after each execution', async () => {
    const onAfterExecute = jest.fn();

    const { gqlExecute, onGqlInit } = krakenJs({
      plugins: mockRootPlugins,
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: (_, __, ctx: any) => 'hello world ' + ctx.operation.id } },
      onAfterExecute
    });

    await onGqlInit({ connectionId }, gqlInitOperation);
    await gqlExecute({ connectionInfo, operationId: '1', document: parse('query { hello }') });
    await gqlExecute({ connectionInfo, operationId: '2', document: parse('query { hello }') });
    await gqlExecute({ connectionInfo, operationId: '3', document: parse('query { hello }') });

    expect(onAfterExecute).toHaveBeenCalledWith(expect.anything(), { 'data': { 'hello': 'hello world 1' } });
    expect(onAfterExecute).toHaveBeenCalledWith(expect.anything(), { 'data': { 'hello': 'hello world 2' } });
    expect(onAfterExecute).toHaveBeenCalledWith(expect.anything(), { 'data': { 'hello': 'hello world 3' } });
  });

  it('should call onDisconnect on disconnect', async () => {
    const onDisconnect = jest.fn();
    const { onGqlInit, onGqlConnectionTerminate } = krakenJs({
      plugins: mockRootPlugins,
      typeDefs: gql('type Query { _: String }'),
      onDisconnect
    });

    await onGqlInit({ connectionId }, gqlInitOperation);
    await onGqlConnectionTerminate({ connectionId });
    expect(onDisconnect).toHaveBeenCalledWith(expect.anything(), { connectionId });
  });

  it('should inject value to context and make it available during execution', async () => {
    const { gqlExecute, onGqlInit } = krakenJs({
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: (_, __, context: any) => context.value } },
      plugins: mockRootPlugins,
      async onConnect() {
        return { value: 'hello from context' } as any;
      }
    });

    await onGqlInit({ connectionId }, gqlInitOperation);
    const response = await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });
    expect(response).toEqual({ data: { hello: 'hello from context' } });
  });

  it('should inject value to context as plugin and make it available during execution', async () => {
    const { gqlExecute, onGqlInit } = krakenJs([{
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: (_, __, context: any) => context.$value } },
      plugins: inject => {
        mockRootPlugins(inject);
        inject('value', 'hello from plugins');
      }
    }]);

    await onGqlInit({ connectionId }, gqlInitOperation);
    const response = await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });
    expect(response).toEqual({ data: { hello: 'hello from plugins' } });
  });
});
