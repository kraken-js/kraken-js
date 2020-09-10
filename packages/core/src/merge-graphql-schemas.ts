import { IExecutableSchemaDefinition } from '@graphql-tools/schema';

const push = (array, value) => {
  if (value) {
    if (Array.isArray(value)) {
      array.push(...value);
    } else {
      array.push(value);
    }
  }
};

export const mergeGraphqlSchemas = <T>(schemas: IExecutableSchemaDefinition<T>[]): IExecutableSchemaDefinition<T> => {
  const result: IExecutableSchemaDefinition<T> = {
    typeDefs: [],
    resolvers: [],
    directiveResolvers: {},
    schemaDirectives: {},
    schemaTransforms: []
  };

  schemas.forEach(schema => {
    push(result.resolvers, schema.resolvers);
    push(result.typeDefs, schema.typeDefs);
    push(result.schemaTransforms, schema.schemaTransforms);

    result.schemaDirectives = { ...result.schemaDirectives, ...schema.schemaDirectives };
    result.directiveResolvers = { ...result.directiveResolvers, ...schema.directiveResolvers };
  });

  return result;
};
