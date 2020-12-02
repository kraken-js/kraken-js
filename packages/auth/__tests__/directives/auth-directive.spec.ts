import { graphqlSchema } from '@kraken.js/auth';
import { krakenJs, KrakenSchema } from '@kraken.js/core';
import { GraphQLError, parse } from 'graphql';

const makeSchema = (schema: KrakenSchema) => {
  return krakenJs([graphqlSchema, schema]);
};

describe('@auth', () => {
  const queryResolvers = {
    Query: {
      getSecureObject: () => ({
        secureField: '🔑',
        singleField: 'owner-id',
        arrayField: ['simple-editor', 'super-editor'],
        truthyField: true,
        falsyField: false,
        nullishField: null
      })
    }
  };

  const mutationResolvers = {
    Mutation: {
      createSecureObject: () => ({
        secureField: '🔑'
      })
    }
  };

  it.each([
    [
      'should not authorize when authorizer does not matches values (user does not have required role)',
      `
      type SecureObject @auth(rules: [{ 
        authorizer: "roles",  match: ["secure.read"]
      }]) { secureField: String }
      
      type Query { getSecureObject: SecureObject }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { roles: ['not-secure'] } },
      { getSecureObject: { secureField: null } }
    ],
    [
      'should not authorize when authorizer does not match with source (user is not the owner of the object)',
      `
      type SecureObject @auth(rules: [{ 
        authorizer: "sub",  source: "singleField"
      }]) { secureField: String }
      
      type Query { getSecureObject: SecureObject }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { sub: 'not-owner' } },
      { getSecureObject: { secureField: null } }
    ],
    [
      'should not authorize when authorizer does not matches values (user does not have required role) [in query]',
      `
      type SecureObject { secureField: String }
      
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        authorizer: "roles",  match: ["secure.read"]
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { roles: ['not-secure'] } },
      { getSecureObject: null }
    ],
    [
      'should not authorize when authorizer does not match with source (user is not the owner of the object) [in query]',
      `
      type SecureObject { secureField: String }
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        authorizer: "sub",  source: "singleField"
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { sub: 'not-owner' } },
      { getSecureObject: null }
    ],
    [
      'should not authorize when authorizer does not match with args (trying to create object with different owner)',
      `
      type Query { _: String }
      type SecureObject { secureField: String }
      input CreateSecureObject { owner: String }
      type Mutation { createSecureObject(input: CreateSecureObject): SecureObject @auth(rules: [{ 
        authorizer: "sub", args: "input.owner"
      }]) }
      `,
      `mutation { createSecureObject(input: { owner: "not-the-owner" }) { secureField } }`,
      { authorizer: { sub: 'owner' } },
      { createSecureObject: null }
    ],
    [
      'should not authorize when authorizer does not match with source (users group is not authorized in source)',
      `
      type SecureObject { secureField: String }
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        authorizer: "groups", source: "arrayField"
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { groups: ['not-allowed-group'] } },
      { getSecureObject: null }
    ],
    [
      'should not authorize when authorizer does not match with source (users is not authorized in source)',
      `
      type SecureObject { secureField: String }
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        authorizer: "sub", source: "arrayField"
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { sub: 'not-allowed-user' } },
      { getSecureObject: null }
    ],
    [
      'should not authorize when source has falsy value (object.public is false)',
      `
      type SecureObject { secureField: String }
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        source: "falsyField", truthy: true
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      {},
      { getSecureObject: null }
    ]
  ])('%s', async (_, typeDefs, source, contextValue: any, expectedResponse) => {
    const resolvers = source.startsWith('query') ? queryResolvers : mutationResolvers;

    const kraken = makeSchema({ typeDefs, resolvers });
    const { data } = await kraken.gqlExecute({
      operationId: '1',
      document: parse(source),
      contextValue
    });
    expect(data).toEqual(expectedResponse);
  });

  it.each([
    [
      'should authorize when authorizer matches values (user have required role)',
      `
      type SecureObject @auth(rules: [{ 
        authorizer: "roles",  match: ["secure.read"]
      }]) { secureField: String }
      
      type Query { getSecureObject: SecureObject }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { roles: ['secure.read'] } },
      { getSecureObject: { secureField: '🔑' } }
    ],
    [
      'should authorize when authorizer match with source (user is the owner of the object)',
      `
      type SecureObject @auth(rules: [{ 
        authorizer: "sub",  source: "singleField"
      }]) { secureField: String }
      
      type Query { getSecureObject: SecureObject }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { sub: 'owner-id' } },
      { getSecureObject: { secureField: '🔑' } }
    ],
    [
      'should authorize when authorizer matches values (user have required role) [in query]',
      `
      type SecureObject { secureField: String }
      
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        authorizer: "roles",  match: ["secure.read"]
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { roles: ['secure.read'] } },
      { getSecureObject: { secureField: '🔑' } }
    ],
    [
      'should authorize when authorizer match with source (user is the owner of the object) [in query]',
      `
      type SecureObject { secureField: String }
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        authorizer: "sub",  source: "singleField"
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { sub: 'owner-id' } },
      { getSecureObject: { secureField: '🔑' } }
    ],
    [
      'should authorize when authorizer does match with source (users group is authorized in source)',
      `
      type SecureObject { secureField: String }
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        authorizer: "groups", source: "arrayField"
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { groups: ['super-editor'] } },
      { getSecureObject: { secureField: '🔑' } }
    ],
    [
      'should authorize when authorizer match with source (users is authorized in source)',
      `
      type SecureObject { secureField: String }
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        authorizer: "sub", source: "arrayField"
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      { authorizer: { sub: 'simple-editor' } },
      { getSecureObject: { secureField: '🔑' } }
    ],
    [
      'should authorize when source has truthy value (object.public is true)',
      `
      type SecureObject { secureField: String }
      type Query { getSecureObject: SecureObject @auth(rules: [{ 
        source: "truthyField", truthy: true
      }]) }
      `,
      `query { getSecureObject { secureField } }`,
      {},
      { getSecureObject: { secureField: '🔑' } }
    ],
    [
      'should authorize when authorizer match with args (trying to create object being the owner)',
      `
      type Query { _: String }
      type SecureObject { secureField: String }
      input CreateSecureObject { owner: String }
      type Mutation { createSecureObject(input: CreateSecureObject): SecureObject @auth(rules: [{ 
        authorizer: "sub", args: "input.owner"
      }]) }
      `,
      `mutation { createSecureObject(input: { owner: "owner" }) { secureField } }`,
      { authorizer: { sub: 'owner' } },
      { createSecureObject: { secureField: '🔑' } }
    ]
  ])('%s', async (_, typeDefs, source, contextValue: any, expectedResponse) => {
    const resolvers = source.startsWith('query') ? queryResolvers : mutationResolvers;

    const kraken = makeSchema({ typeDefs, resolvers });
    const { data } = await kraken.gqlExecute({
      operationId: '1',
      document: parse(source),
      contextValue
    });
    expect(data).toEqual(expectedResponse);
  });

  it('should throw exception when silent=false', async () => {
    const typeDefs = `
      type SecureObject @auth(silent: false, rules: [{ 
        authorizer: "roles",  match: ["secure.read"]
      }]) { secureField: String }
      
      type Query { getSecureObject: SecureObject }
      `;
    const source = `query { getSecureObject { secureField } }`;
    const contextValue = { authorizer: { roles: ['not-the-one-required'] } } as any;

    const kraken = makeSchema({ typeDefs });
    try {
      await kraken.gqlExecute({
        operationId: '1',
        document: parse(source),
        contextValue
      });
    } catch (error) {
      expect(error[0]).toEqual(new GraphQLError('Unauthorized'));
    }
  });
});
