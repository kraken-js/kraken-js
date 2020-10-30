import { KrakenSchema } from '@kraken.js/core';
import 'jest-dynalite/withDb';
import { dynamoDb, setupKrakenRuntime } from './helpers';

const testSchema: KrakenSchema = {
  typeDefs: `
    type Query { 
      model(id: ID!): Model @get
      modelInput(input: GetModel!): Model @get
      existingTable(id: ID!): ExistingTable @get
    }
    type Model @model(partitionKey: "id") {
      id: ID!
      name: String
      relatedId: ID!
      channel: ID
      timestamp: ID
      related: Model @get(sourceMapping: ["relatedId:id"])
      message: Message @get(sourceMapping: ["channel", "timestamp"])
    }
    type Message @model(partitionKey: "channel", sortKey: "timestamp") {
      channel: ID!
      timestamp: String!
    }
    type ExistingTable @model(table: "ExistingTable") {
      id: ID!
      name: String
    }
    input GetModel {
      id: ID!
    }`
};

describe('@get', () => {
  beforeEach(async () => {
    await dynamoDb.put({
      TableName: 'Model-test-stage',
      Item: { id: 'first', name: 'First', relatedId: 'second' }
    }).promise();
    await dynamoDb.put({
      TableName: 'Model-test-stage',
      Item: { id: 'second', name: 'Second' }
    }).promise();
    await dynamoDb.put({
      TableName: 'ExistingTable',
      Item: { id: 'existing', name: 'Table' }
    }).promise();
  });

  it.each([
    ['{ model(id: "notfound") { id name } }', {
      model: null
    }],
    ['{ model(id: "first") { id name } }', {
      model: {
        id: 'first',
        name: 'First'
      }
    }],
    ['{ modelInput(input: {id: "second"}) { id name } }', {
      modelInput: {
        id: 'second',
        name: 'Second'
      }
    }],
    ['{ existingTable(id: "existing") { id name } }', {
      existingTable: {
        id: 'existing',
        name: 'Table'
      }
    }],
    ['{ model(id: "first") { id name related { id } } }', {
      model: {
        id: 'first',
        name: 'First',
        related: { id: 'second' }
      }
    }],
    ['{ model(id: "first") { id name message { channel timestamp } } }', {
      model: {
        id: 'first',
        name: 'First',
        message: null
      }
    }]
  ])('should get item from dynamodb for query %s', async (document, data) => {
    const krakenRuntime = setupKrakenRuntime(testSchema);
    const response = await krakenRuntime.gqlExecute({ operationId: '1', document });
    expect(response).toEqual({ data });
  });
});
