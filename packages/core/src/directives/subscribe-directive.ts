import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export class SubscribeDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const triggerName = this.args.triggerName || field.name;

    field.resolve = async function(source, args, context: Kraken.ExecutionContext, info) {
      if (context.$subMode === 'OUT') {
        const sourceWithFieldValue = { ...source, [info.fieldName]: info.rootValue };
        return resolve.apply(this, [sourceWithFieldValue, args, context, info]);
      }

      try {
        await context.$pubsub.subscribe(triggerName, args);
        return await resolve.apply(this, [source, args, context, info]);
      } catch (e) {
        console.error(e);
      }
    };
  }
}
