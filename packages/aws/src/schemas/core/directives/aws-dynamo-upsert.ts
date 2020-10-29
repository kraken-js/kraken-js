import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';
import { nanoid } from 'nanoid';
import { getMapping, getTargetModelInfo, isoDate, makeModifier, prefixOperatorsWith$ } from './helpers';

export class AwsDynamoUpsertDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolver = defaultFieldResolver } = field;
    const { tableName, partitionKey, sortKey, timestamp, versioned } = getTargetModelInfo(field);
    const { sourceMapping, conditional } = this.args;
    const name = this.name;

    const extractCondition = (item) => {
      const condition = getMapping(item, conditional);
      conditional?.forEach(condition => delete item[condition]);
      if (versioned) {
        const version = item.version;
        delete item.version;
        return { ...condition, version: version ? version : { $exists: false } };
      }
      return condition;
    };

    const spreadKeysAndModifier = (item) => {
      if (sortKey) {
        const { [partitionKey]: pk, [sortKey]: sk, ...modifier } = item;
        return { [partitionKey]: pk, [sortKey]: sk, modifier: makeModifier(modifier) };
      }
      const { [partitionKey]: pk, ...modifier } = item;
      return { [partitionKey]: pk, modifier: makeModifier(modifier) };
    };

    field.resolve = async (source, args, context: Kraken.Context, info) => {
      const { $dynongo } = context;
      const { input, ...spread } = args;
      const mapping = getMapping(source, sourceMapping);

      const timestamped = timestamp ? { timestamp: isoDate() } : undefined;
      const item = {
        [partitionKey]: nanoid(),
        ...timestamped,
        ...input,
        ...spread,
        ...mapping
      };

      const condition = extractCondition(item);

      const { modifier, ...keys } = spreadKeysAndModifier(item);
      if (versioned) modifier.inc = { ...modifier.inc, version: 1 };

      const table = $dynongo.table(tableName);
      const operation = (() => {
        switch (name) {
          case 'put':
            return table.upsert(keys, prefixOperatorsWith$(modifier));
          case 'update':
            return table.update(keys, prefixOperatorsWith$(modifier));
        }
      })();

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
