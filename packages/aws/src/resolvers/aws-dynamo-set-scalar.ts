import { GraphQLScalarType } from 'graphql';
import { DynamoDB } from 'aws-sdk';

export const DynamoDbSet = new GraphQLScalarType({
  name: 'DynamoDbSet',
  description: 'DynamoDB Set',
  serialize(value) {
    if (value) {
      if (value.hasOwnProperty('values')) return value.values;
      if (Array.isArray(value)) return value;
    }
    return null;
  },
  parseValue(value) {
    if (!this.documentClient) this.documentClient = new DynamoDB.DocumentClient();
    if (Array.isArray(value)) return this.documentClient.createSet(value);
    return value;
  }
});
