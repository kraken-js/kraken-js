import { IExecutableSchemaDefinition } from '@graphql-tools/schema';
import { ITypedef } from '@graphql-tools/utils';
import { deepMerge } from './helpers';

export const mergeGraphqlSchemas = <T>(schemas: IExecutableSchemaDefinition<T>[]): IExecutableSchemaDefinition<T> => {
  const result: IExecutableSchemaDefinition<T> = {
    typeDefs: [],
    resolvers: {},
    directiveResolvers: {},
    schemaDirectives: {},
    schemaTransforms: []
  };

  schemas.forEach(schema => {
    const typeDefs = result.typeDefs as Array<ITypedef>;
    if (Array.isArray(schema.typeDefs)) {
      typeDefs.push(...schema.typeDefs);
    } else {
      typeDefs.push(schema.typeDefs);
    }

    if (schema.schemaTransforms) {
      result.schemaTransforms?.push(...schema.schemaTransforms);
    }

    result.resolvers = deepMerge(result.resolvers, schema.resolvers);
    result.schemaDirectives = { ...result.schemaDirectives, ...schema.schemaDirectives };
    result.directiveResolvers = { ...result.directiveResolvers, ...schema.directiveResolvers };
  });

  return result;
};
