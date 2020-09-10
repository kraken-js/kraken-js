import { IExecutableSchemaDefinition } from '@graphql-tools/schema';
import { PublishDirective } from './directives/publish-directive';
import { SubscribeDirective } from './directives/subscribe-directive';
// @ts-ignore
import * as typeDefs from './schema.graphql';

export const schemaDirectives = {
  pub: PublishDirective,
  sub: SubscribeDirective
};

export const graphqlSchema: IExecutableSchemaDefinition = {
  typeDefs,
  schemaDirectives,
  resolvers: {
    Mutation: {
      ping: (_, args) => ({
        ...args,
        timestamp: Date.now()
      })
    }
  }
};
