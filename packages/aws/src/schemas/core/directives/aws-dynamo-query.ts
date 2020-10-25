import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { fromBase64, getMapping, getTargetModelInfo, prefixOperatorsWith$, toBase64 } from './helpers';

/**
 * type Message @model { channel: ID! timestamp: Float message: String sentBy: ID }
 * type MessagesConnection { items: [Message] nextToken: String }
 * input QueryMessagesFilterInput { or: [QueryMessagesFilterInput] and: [QueryMessagesFilterInput] sentBy: ID  }
 *
 *  Query {
 *   getMessages(channel: ID! filter: QueryMessagesFilterInput limit: Int nextToken: String): MessagesConnection @query
 * }
 */
export class AwsDynamoQueryDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { tableName, connection, isList } = getTargetModelInfo(field);
    const { index, sourceMapping } = this.args;

    field.resolve = async (source, args, { $dynongo }: Kraken.Context) => {
      const { filter, nextToken, limit, sort = 'DESC', ...spread } = args;

      const mapping = getMapping(source, sourceMapping);
      const keyCondition = {
        ...spread,
        ...mapping
      };

      const keys = prefixOperatorsWith$(keyCondition);
      const find = $dynongo.table(tableName).find(keys, index);
      if (filter) find.where(prefixOperatorsWith$(filter));

      const raw = find
        .limit(limit)
        .startFrom(fromBase64(nextToken))
        .sort(sort === 'ASC' ? 1 : -1)
        .raw();

      if (process.env.DEBUG) {
        console.debug(raw.buildRawQuery());
      }

      const { Items = [], LastEvaluatedKey } = await raw.exec();
      if (isList) {
        return connection ? { [connection.name]: Items, nextToken: toBase64(LastEvaluatedKey) } : Items;
      }
      return Items[0];
    };
  }
}
