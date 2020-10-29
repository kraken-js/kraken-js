import { KrakenSchema } from '@kraken.js/core';
import { GraphQLError } from 'graphql';
import 'jest-dynalite/withDb';
import { dynamoDb, setupKrakenRuntime } from './helpers';

const testSchema: KrakenSchema = {
  typeDefs: `
    type Query { _: String }
    type Mutation {
        deleteMessage(input: DeleteMessageInput!): Message @delete
        deleteMessageConditional(input: DeleteMessageInput!): Message @delete(conditional: ["version"])
    }
    type Message @model(partitionKey: "channel" sortKey: "timestamp" versioned: true timestamp: true) {
        channel: ID!
        timestamp: String!
        message: String!
        sentBy: ID!
        version: Int
    }
    input DeleteMessageInput {
        channel: ID!
        timestamp: String!
        version: Int
    }
`
};

describe('@delete', () => {
  const existing = { channel: 'general', timestamp: '10000', message: 'hi', sentBy: 'me', version: 4 };

  beforeEach(async () => {
    await dynamoDb.put({
      TableName: 'Message-test-stage',
      Item: existing
    }).promise();
  });

  it.each([
    [`mutation { 
        deleteMessage(input: { channel: "general" timestamp: "10000" }) { 
          channel timestamp message sentBy version
        } 
      }`, {
      deleteMessage: {
        channel: 'general',
        timestamp: '10000',
        message: 'hi',
        sentBy: 'me',
        version: 4
      }
    }, { channel: 'general', timestamp: '10000' }],
    [`mutation { 
        deleteMessageConditional(input: { channel: "general" timestamp: "10000" version: 4 }) { 
          channel timestamp message sentBy version
        } 
      }`, {
      deleteMessageConditional: {
        channel: 'general',
        timestamp: '10000',
        message: 'hi',
        sentBy: 'me',
        version: 4
      }
    }, { channel: 'general', timestamp: '10000' }],
    [`mutation { 
        deleteMessage(input: { channel: "general" timestamp: "not-found" }) { 
          channel timestamp message sentBy version
        } 
      }`, {
      deleteMessage: null
    }, { channel: 'general', timestamp: 'not-found' }]
  ])('should delete item on dynamodb for mutation %s', async (document, data, key) => {
    const krakenRuntime = setupKrakenRuntime(testSchema);
    const response = await krakenRuntime.gqlExecute({ operationId: '1', document });
    expect(response).toEqual({ data });

    const { Item } = await dynamoDb.get({ TableName: 'Message-test-stage', Key: key }).promise();
    expect(Item).toBeUndefined();
  });

  it.each([
    [`mutation { 
        deleteMessageConditional(input: { channel: "general" timestamp: "10000" version: 100000 }) { 
          channel timestamp message sentBy version
        } 
      }`, {
      deleteMessageConditional: null
    }, { channel: 'general', timestamp: '10000' }]
  ])('should not delete item on dynamodb for mutation %s', async (document, data, key) => {
    const krakenRuntime = setupKrakenRuntime(testSchema);
    const response = await krakenRuntime.gqlExecute({ operationId: '1', document });
    expect(response).toEqual({ data, errors: [new GraphQLError('The conditional request failed')] });

    const { Item } = await dynamoDb.get({ TableName: 'Message-test-stage', Key: key }).promise();
    expect(Item).toBeDefined();
  });
});
