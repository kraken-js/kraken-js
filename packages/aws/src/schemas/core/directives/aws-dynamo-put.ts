import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';
import { nanoid } from 'nanoid';
import { getMapping, getTargetModelInfo } from './helpers';

export class AwsDynamoPutDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolver = defaultFieldResolver } = field;
    const { tableName, partitionKey, sortKey, timestamp, versioned } = getTargetModelInfo(field);
    const { sourceMapping, conditional } = this.args;

    const timestampIt = (item) => {
      if (timestamp) return { timestamp: new Date().toISOString(), ...item };
      return item;
    };

    const makeCondition = (item) => {
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
        return { [partitionKey]: pk, [sortKey]: sk, modifier };
      }
      const { [partitionKey]: pk, ...modifier } = item;
      return { [partitionKey]: pk, modifier };
    };

    field.resolve = async (source, args, context: Kraken.Context, info) => {
      const { input, ...spread } = args;
      const { $dynongo } = context;

      const mapping = getMapping(source, sourceMapping);
      const item = timestampIt({
        [partitionKey]: nanoid(),
        ...input,
        ...spread,
        ...mapping
      });

      const condition = makeCondition(item);

      const { modifier, ...keys } = spreadKeysAndModifier(item);
      if (versioned) modifier.$inc = modifier.$inc ? { ...modifier.$inc, version: 1 } : { version: 1 };

      const update = $dynongo.table(tableName).upsert(keys, modifier);
      if (condition) update.where(condition);

      if (process.env.DEBUG) {
        console.debug(update.buildRawQuery());
      }

      // execute :)
      const response = await update.exec();

      // make it so the defaultResolver can resolve it
      source = { ...source, [field.name]: response };
      return resolver.call(this, source, args, context, info);
    };
  }
}
