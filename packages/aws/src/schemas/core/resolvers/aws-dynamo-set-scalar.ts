import DynamoDBSet from 'aws-sdk/lib/dynamodb/set';
import { GraphQLScalarType } from 'graphql';

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
    if (Array.isArray(value)) return new DynamoDBSet(value);
    return value;
  }
});
