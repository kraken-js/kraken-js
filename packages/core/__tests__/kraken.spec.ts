import { krakenIt } from '@kraken.js/core';
import { parse } from 'graphql';
import gql from 'graphql-tag';
import { rootPlugins } from './utils';

describe('Kraken', () => {
  const gqlInitOperation = { type: 'connection_init', payload: {} as any };
  const connectionId = Math.random().toString(8);
  const operationId = Math.random().toString(8);
  const connectionInfo = { connectionId };

  it('should execute simple graphql operation', async () => {
    const { gqlExecute, onGqlInit } = krakenIt({
      plugins: rootPlugins,
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: () => 'hello world' } }
    });

    await onGqlInit({ connectionId }, gqlInitOperation);
    const response = await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });
    expect(response).toEqual({ data: { hello: 'hello world' } });
  });

  it('should execute call onBeforeExecute before each execution', async () => {
    const onBeforeExecute = jest.fn();

    const { gqlExecute, onGqlInit } = krakenIt({
      plugins: rootPlugins,
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
      operationId
    }), expect.objectContaining({ definitions: expect.anything() }));
  });

  it('should execute call onAfterExecute after each execution', async () => {
    const onAfterExecute = jest.fn();

    const { gqlExecute, onGqlInit } = krakenIt({
      plugins: rootPlugins,
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: (_, __, ctx) => 'hello world ' + ctx.operationId } },
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

  it('should inject value to context and make it available during execution', async () => {
    const { gqlExecute, onGqlInit } = krakenIt({
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: (_, __, context) => context.value } },
      plugins: rootPlugins,
      onConnectionInit: () => {
        return { value: 'hello from context' };
      }
    });

    await onGqlInit({ connectionId }, gqlInitOperation);
    const response = await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });
    expect(response).toEqual({ data: { hello: 'hello from context' } });
  });

  it('should inject value to context as plugin and make it available during execution', async () => {
    const { gqlExecute, onGqlInit } = krakenIt([{
      typeDefs: gql('type Query { hello: String }'),
      resolvers: { Query: { hello: (_, __, context) => context.$value } },
      plugins: inject => {
        rootPlugins(inject);
        inject('value', 'hello from plugins');
      }
    }]);

    await onGqlInit({ connectionId }, gqlInitOperation);
    const response = await gqlExecute({ connectionInfo, operationId, document: parse('query { hello }') });
    expect(response).toEqual({ data: { hello: 'hello from plugins' } });
  });
});
