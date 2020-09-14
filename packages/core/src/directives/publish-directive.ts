import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export class PublishDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const triggerName = this.args.triggerName;
    const typeName = field.type?.name;

    field.resolve = async function(source, args, context: Kraken.ExecutionContext, info) {
      const result = await resolve.apply(this, [source, args, context, info]);
      await context.$pubsub.publish(triggerName, {
        __typename: typeName,
        ...result
      });
      return result;
    };
  }
}
