import { KrakenSchema } from '@kraken.js/core';
import 'jest-dynalite/withDb';
import { dynamoDb, setupKrakenRuntime } from './helpers';

const testSchema: KrakenSchema = {
  typeDefs: `
    type Query { 
      messages(
        # partition keys
        channel: ID!, 
        timestamp: StringFilterInput
        # extra filters and pagination
        filter: MessageFilterInput
        sort: Sort
        limit: Int
        nextToken: String
      ): MessageConnection @query
      messagesBySentBy(
        # partition keys
        sentBy: ID!,
        timestamp: StringFilterInput
        # extra filters and pagination
        filter: MessageFilterInput
        sort: Sort
        limit: Int
        nextToken: String
      ): MessageConnection @query(index:"bySentBy")
      message(
        # partition keys
        channel: ID!, 
        timestamp: StringFilterInput
        # extra filters and pagination
        filter: MessageFilterInput
        limit: Int
        nextToken: String
      ): Message @query
    }
    type Message @model {
      channel: ID!
      timestamp: String!
      message: String!
      sentBy: ID!
      hasEmoji: Boolean
    }
    type MessageConnection {
      nodes: [Message]
      nextToken: String
    }
    input MessageFilterInput {
      message: StringFilterInput
      sentBy: StringFilterInput
      hasEmoji: BooleanFilterInput
      or: [MessageFilterInput!]
      and: [MessageFilterInput!]
    }
`
};

describe('@query', () => {
  const u11 = { channel: 'general', timestamp: '10000', message: 'hi', sentBy: 'u1', hasEmoji: false };
  const u21 = { channel: 'general', timestamp: '11000', message: 'hello :)', sentBy: 'u2', hasEmoji: true };
  const u22 = { channel: 'general', timestamp: '11100', message: 'how are you?', sentBy: 'u2', hasEmoji: false };
  const u23 = { channel: 'random', timestamp: '11110', message: 'hey', sentBy: 'u2', hasEmoji: true };

  beforeEach(async () => {
    for (const message of [u11, u21, u22, u23]) {
      await dynamoDb.put({
        TableName: 'Message-test-stage',
        Item: message
      }).promise();
    }
  });

  it.each([
    ['{ messages(channel: "notfound") { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [], nextToken: null }
    }],
    ['{ messagesBySentBy(sentBy: "notfound") { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messagesBySentBy: { nodes: [], nextToken: null }
    }],
    ['{ messages(channel: "random") { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u23], nextToken: null }
    }],
    ['{ messagesBySentBy(sentBy: "u1") { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messagesBySentBy: { nodes: [u11], nextToken: null }
    }],
    ['{ messagesBySentBy(sentBy: "u2") { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messagesBySentBy: { nodes: [u23, u22, u21], nextToken: null }
    }],
    ['{ messages(channel: "general") { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u22, u21, u11], nextToken: null }
    }],
    ['{ messages(channel: "general", sort: DESC) { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u22, u21, u11], nextToken: null }
    }],
    ['{ messages(channel: "general", sort: ASC) { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u11, u21, u22], nextToken: null }
    }],
    ['{ messages(channel: "general", limit: 2) { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u22, u21], nextToken: 'eyJjaGFubmVsIjoiZ2VuZXJhbCIsInRpbWVzdGFtcCI6IjExMDAwIn0=' }
    }],
    ['{ messages(channel: "general", limit: 2 nextToken: "eyJjaGFubmVsIjoiZ2VuZXJhbCIsInRpbWVzdGFtcCI6IjExMDAwIn0=") { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u11], nextToken: null }
    }],
    ['{ messages(channel: "general", filter: { sentBy: { eq: "u1"} }) { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u11], nextToken: null }
    }],
    ['{ messages(channel: "general", timestamp: { gte: "11000" }) { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u22, u21], nextToken: null }
    }],
    ['{ messages(channel: "general", filter: { hasEmoji: { eq: true } }) { nodes { channel timestamp message sentBy hasEmoji } nextToken } }', {
      messages: { nodes: [u21], nextToken: null }
    }],
    ['{ message(channel: "general", filter: { sentBy: { eq: "u1"} }) { channel timestamp message sentBy hasEmoji } }', {
      message: u11
    }]
  ])('should query item from dynamodb for query %s', async (document, data) => {
    const krakenRuntime = setupKrakenRuntime(testSchema);
    const response = await krakenRuntime.gqlExecute({ operationId: '1', document });
    expect(response).toEqual({ data });
  });
});
