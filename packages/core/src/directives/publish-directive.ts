import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver, isObjectType } from 'graphql';

export class PublishDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const typeName = field.type?.name;
    const triggerNames = this.args.triggerNames;
    const isObject = isObjectType(field.type);

    field.resolve = async function(source, args, context: Kraken.ExecutionContext, info) {
      const result = await resolve.apply(this, [source, args, context, info]);
      const payload = isObject ? { __typename: typeName, ...result } : result;
      for (const triggerName of triggerNames) {
        await context.$pubsub.publish(triggerName, payload);
      }
      return result;
    };
  }
}
