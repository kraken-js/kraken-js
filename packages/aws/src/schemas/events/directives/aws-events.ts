import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export class EventBridgeEventDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const eventSource = this.args.source || field.name;
    const eventType = this.args.type;
    field.resolve = async (source, args, $context: Kraken.Plugins, info) => {
      const response = await resolve.apply(this, [source, args, $context, info]);
      await $context.$events.source(eventSource).type(eventType).event(response).send();
      return response;
    };
  }
}
