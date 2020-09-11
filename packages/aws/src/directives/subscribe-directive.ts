import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export class SubscribeDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const triggerName = this.args.triggerName;

    field.resolve = async function(source, args, context, info) {
      const { $subscriptions, connectionId, subscriptionId, apiGatewayUrl } = context;

      await $subscriptions.subscribe(triggerName, {
        connectionId, subscriptionId, apiGatewayUrl,
        ...args // variables for filtering
      });

      return await resolve.apply(this, [source, args, context, info]);
    };
  }
}
