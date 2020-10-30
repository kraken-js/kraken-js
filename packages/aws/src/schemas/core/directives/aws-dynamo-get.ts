import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { getMapping, getTargetModelInfo } from './helpers';

/**
 * type One @model { id: ID! }
 * input GetOneInput { id: ID! }
 *
 * type Root {
 *   oneId: ID!
 *   one: One @get(sourceMapping: ["oneId:id"])
 * }
 *
 * Query {
 *   getOne(id: ID!): One @get
 *   getOne(input: GetOneInput!): One @get
 * }
 */
export class AwsDynamoGetDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { tableName, partitionKey, sortKey } = getTargetModelInfo(field);
    const sourceMapping = this.args.sourceMapping;

    field.resolve = async (source, args, $context: Kraken.Context) => {
      const { input, ...spread } = args;
      const mapping = getMapping(source, sourceMapping);
      const key = {
        ...input,
        ...spread,
        ...mapping
      };

      // cannot get without pk and optional sk
      if (!key[partitionKey]) return null;
      if (sortKey && !key[sortKey]) return null;

      return await $context.$dynamoDbDataLoader.load({
        TableName: tableName,
        Key: key
      });
    };
  }
}
