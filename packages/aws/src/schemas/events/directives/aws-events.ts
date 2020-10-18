import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export class EventBridgeEventDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const {
      source: eventSource = field.type.name,
      type: eventType = field.name
    } = this.args;

    field.resolve = async (source, args, $context: Kraken.Plugins, info) => {
      const response = await resolve.apply(this, [source, args, $context, info]);
      await $context.$events.source(eventSource).type(eventType).event(response).send().then(res => {
        if (res.FailedEntryCount) console.error('Error sending event:', res);
        return res;
      });
      return response;
    };
  }
}
