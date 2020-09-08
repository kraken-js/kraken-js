// @ts-ignore
import * as typeDefs from './schema.graphql';

export const graphqlSchema = {
  typeDefs,
  resolvers: {
    Stats: {
      region: () => process.env.AWS_REGION
    }
  }
};
