import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export class EventBridgeEventDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const {
      source: eventSource = field.type.name,
      type: eventType = field.name
    } = this.args;

    field.resolve = async (source, args, $context: Kraken.Context, info) => {
      const response = await resolve.apply(this, [source, args, $context, info]);
      await $context.$events.put({ source: eventSource, type: eventType, payload: response }).send();
      return response;
    };
  }
}
