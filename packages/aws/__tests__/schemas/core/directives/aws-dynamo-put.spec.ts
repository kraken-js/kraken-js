import { graphqlSchema } from '@kraken.js/aws';
import { krakenJs, KrakenSchema } from '@kraken.js/core';
import { DynamoDB } from 'aws-sdk';
import 'jest-dynalite/withDb';

const testSchema: KrakenSchema = {
  typeDefs: `
    type Query { _: String }
    type Mutation {
        sendMessage(input: MessageInput!): Message! @put
        saveModel(input: ModelInput!): Model! @put
    }
    type Model @model(partitionKey: "id" versioned: false timestamp: false) {
      id: ID!
      name: String
    }
    type Message @model(partitionKey: "channel" sortKey: "timestamp" versioned: true timestamp: true) {
        channel: ID!
        timestamp: String!
        message: String!
        sentBy: ID!
        version: Int
    }
    input MessageInput {
        channel: ID!
        timestamp: String
        version: Int
        message: String!
        sentBy: ID!
    }
    input ModelInput {
      id: ID
      name: String
    }
`
};

const dynamoDb = new DynamoDB.DocumentClient({
  endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
  sslEnabled: false,
  region: 'local'
});

const setupKrakenRuntime = () => {
  return krakenJs([
    graphqlSchema({ dynamoDb }),
    testSchema
  ]);
};


describe('@put', () => {
  const timestamp = expect.stringMatching(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+/);
  const existing = { channel: 'general', timestamp: '10000', message: 'hi', sentBy: 'u1', version: 4 };

  beforeEach(async () => {
    await dynamoDb.put({
      TableName: 'Message-test-stage',
      Item: existing
    }).promise();
  });

  it.each([
    [`mutation { 
        sendMessage(input: { channel: "general" message: "hi" sentBy: "me" }) { 
          channel timestamp message sentBy version
        } 
      }`, {
      sendMessage: {
        channel: 'general',
        message: 'hi',
        sentBy: 'me',
        version: 1,
        timestamp
      }
    }],
    [`mutation { 
        sendMessage(input: { channel: "general" timestamp: "10000" message: "hi" sentBy: "me" version: 4 }) { 
          channel timestamp message sentBy version
        } 
      }`, {
      sendMessage: {
        channel: 'general',
        message: 'hi',
        sentBy: 'me',
        version: 5,
        timestamp: '10000'
      }
    }],
    [`mutation { 
        saveModel(input: { name: "model X" }) { 
          id name
        } 
      }`, {
      saveModel: {
        id: expect.stringMatching(/.{21}/),
        name: 'model X'
      }
    }]
  ])('should upsert item on dynamodb for mutation %s', async (document, data) => {
    const krakenRuntime = setupKrakenRuntime();
    const response = await krakenRuntime.gqlExecute({ operationId: '1', document });
    expect(response).toEqual({ data });
  });

  it.each([
    [`mutation { 
        sendMessage(input: { channel: "general" timestamp: "10000" message: "hi" sentBy: "me" version: 2 }) { 
          channel timestamp message sentBy version
        } 
      }`,
      [{
        locations: expect.anything(),
        message: 'The conditional request failed',
        path: ['sendMessage']
      }]
    ],
    [`mutation { 
        sendMessage(input: { channel: "general" message: "hi" sentBy: "me" version: 222 }) { 
          channel timestamp message sentBy version
        } 
      }`,
      [{
        locations: expect.anything(),
        message: 'The conditional request failed',
        path: ['sendMessage']
      }]
    ]
  ])('should fail to item on dynamodb for mutation %s', async (document, errors) => {
    const krakenRuntime = setupKrakenRuntime();
    const response = await krakenRuntime.gqlExecute({ operationId: '1', document });
    expect(response).toEqual({ data: null, errors });
  });
});
