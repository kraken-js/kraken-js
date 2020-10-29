import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';
import { extractKeys, getMapping, getTargetModelInfo } from './helpers';

export class AwsDynamoDeleteDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolver = defaultFieldResolver } = field;
    const { tableName, partitionKey, sortKey } = getTargetModelInfo(field);
    const { sourceMapping, conditional } = this.args;

    const extractCondition = (item) => {
      const condition = getMapping(item, conditional);
      conditional?.forEach(condition => delete item[condition]);
      return condition;
    };

    field.resolve = async (source, args, context: Kraken.Context, info) => {
      const { $dynongo } = context;
      const { input, ...spread } = args;
      const mapping = getMapping(source, sourceMapping);

      const item = {
        ...input,
        ...spread,
        ...mapping
      };

      const condition = extractCondition(item);
      const keys = extractKeys(item, partitionKey, sortKey);

      const operation = $dynongo.table(tableName).findOneAndRemove(keys);
      if (condition) operation.where(condition);

      if (process.env.DEBUG) {
        console.debug(operation.buildRawQuery());
      }

      // execute :)
      const response = await operation.exec();

      // make it so the defaultResolver can resolve it
      source = { ...source, [field.name]: response };
      return resolver.call(this, source, args, context, info);
    };
  }
}
