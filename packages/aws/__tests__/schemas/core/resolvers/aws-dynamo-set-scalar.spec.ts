import { DynamoDbSet } from '@kraken.js/aws/src/schemas/core/resolvers/aws-dynamo-set-scalar';
import 'aws-sdk';
import DynamoDBSet from 'aws-sdk/lib/dynamodb/set';

describe('AWS DynamoDB Set Scalar', () => {
  it.each([
    [new DynamoDBSet([1, 2]), [1, 2]],
    [[1, 2], [1, 2]],
    ['str', null],
    [null, null]
  ])('should serialize %o to %o', (input, expected) => {
    const actual = DynamoDbSet.serialize(input);
    expect(actual).toEqual(expected);
  });

  it.each([
    [[1, 2], new DynamoDBSet([1, 2])],
    ['str', 'str'],
    [null, null]
  ])('should parseValue %o to %o', (input, expected) => {
    const actual = DynamoDbSet.parseValue(input);
    expect(actual).toEqual(expected);
  });
});
