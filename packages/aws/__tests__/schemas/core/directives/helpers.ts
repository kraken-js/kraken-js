import { graphqlSchema } from '@kraken.js/aws';
import { krakenJs } from '@kraken.js/core';
import { DynamoDB } from 'aws-sdk';

export const dynamoDb = new DynamoDB.DocumentClient({
  endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
  sslEnabled: false,
  region: 'local'
});


export const setupKrakenRuntime = (testSchema) => {
  return krakenJs([
    graphqlSchema({ dynamoDb }),
    testSchema
  ]);
};
