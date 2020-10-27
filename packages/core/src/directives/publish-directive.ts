import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export class PublishDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const triggerNames = this.args.triggerNames;
    const noSelfSubscriptionUpdate = this.args.noSelfSubscriptionUpdate;

    field.resolve = async function(source, args, context: Kraken.ExecutionContext, info) {
      const result = await resolve.apply(this, [source, args, context, info]);
      for (const triggerName of triggerNames) {
        await context.$pubsub.publish(triggerName, result, { noSelfSubscriptionUpdate });
      }
      return result;
    };
  }
}
