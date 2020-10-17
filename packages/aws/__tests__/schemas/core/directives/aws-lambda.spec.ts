import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { graphqlSchema as krakenJsAws } from '@kraken.js/aws';
import { krakenJs, KrakenSchema } from '@kraken.js/core';

const mockDirective = jest.fn();
const mockDirectiveSchema = {
  typeDefs: 'directive @mock on FIELD_DEFINITION',
  schemaDirectives: {
    mock: class extends SchemaDirectiveVisitor {
      visitFieldDefinition(field) {
        field.resolve = (source, args, context) => mockDirective({ source, args, context });
      }
    }
  }
};

const lambdaMock = {
  invoke: jest.fn(() => ({
    promise: () => Promise.resolve({ Payload: '{}' })
  }))
} as any;

const setupKrakenRuntime = (extraSchema: KrakenSchema) => {
  return krakenJs([
    krakenJsAws({ lambda: lambdaMock }),
    mockDirectiveSchema,
    extraSchema
  ]);
};

describe('@lambda', () => {
  it.each([
    [
      `type Query { _: String @lambda(name: "$thisIsMyFullName") }`,
      `query { _ }`,
      'thisIsMyFullName'
    ],
    [
      `type Query { _: String @lambda(name: "getUnderscore" shouldParse: false) }`,
      `query { _ }`,
      'test-service-test-stage-getUnderscore'
    ]
  ])('should use or generate the function name according to the config %s', async (typeDefs, document, functionName) => {
    const kraken = setupKrakenRuntime({ typeDefs });
    await kraken.gqlExecute({ operationId: '1', document });
    expect(kraken.$lambda.invoke).toHaveBeenCalledWith({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: expect.any(String)
    });
  });

  it.each([
    [
      'should call with default RequestResponse invocationType',
      `type Query { _: String @lambda(name: "lambda1", shouldParse: false) }`,
      `query { _ }`,
      {
        FunctionName: 'test-service-test-stage-lambda1',
        InvocationType: 'RequestResponse',
        Payload: expect.any(String)
      }
    ],
    [
      'should call with Event invocationType',
      `type Query { _: String @lambda(name: "lambda2", invocationType: "Event", shouldParse: false) }`,
      `query { _ }`,
      {
        FunctionName: 'test-service-test-stage-lambda2',
        InvocationType: 'Event',
        Payload: expect.any(String)
      }
    ]
  ])('%s', async (_, typeDefs, document, expectedInvoke) => {
    const kraken = setupKrakenRuntime({ typeDefs });
    await kraken.gqlExecute({ operationId: '1', document });
    expect(kraken.$lambda.invoke).toHaveBeenCalledWith(expectedInvoke);
  });

  it.each([
    [
      'should call next resolver with modified args when used in chain',
      `type Query { _: String @mock @lambda(name: "lambda1") }`,
      `query { _ }`,
      '{ "args": { "fromLambda": true } }',
      { source: undefined, args: { fromLambda: true }, context: expect.anything() }
    ],
    [
      'should call next resolver with modified source when used in chain',
      `type Query { _(id: ID): String @mock @lambda(name: "lambda1") }`,
      `query { _(id: "1") }`,
      '{ "source": { "fromLambda": true } }',
      { source: { fromLambda: true }, args: { id: '1' }, context: expect.anything() }
    ]
  ])('%s', async (_, typeDefs, document, lambdaResponse, expectedChainCall) => {
    const kraken = setupKrakenRuntime({ typeDefs });
    (lambdaMock.invoke as jest.Mock).mockReturnValueOnce({
      promise: () => Promise.resolve({ Payload: lambdaResponse })
    });
    await kraken.gqlExecute({ operationId: '1', document });
    expect(mockDirective).toHaveBeenCalledWith(expectedChainCall);
  });

  it.each([
    [
      'should return raw response from lambda',
      `type Query { _: String @lambda(name: "lambda", shouldParse: false) }`,
      `query { _ }`,
      { Payload: 'from lambda' },
      { data: { _: 'from lambda' } }
    ],
    [
      'should return parsed response from lambda',
      `type Query { _:_ @lambda(name: "lambda") }
       type _ { _: String }`,
      `query { _ { _ }}`,
      { Payload: JSON.stringify({ _: 'from lambda' }) },
      { data: { _: { _: 'from lambda' } } }
    ],
    [
      'should return parsed response from lambda',
      `type Query { _:_ @lambda(name: "lambda") }
       type _ { _: String }`,
      `query { _ { _ }}`,
      { FunctionError: 'failed', Payload: JSON.stringify({ errorType: 'type o-', errorMessage: 'no message' }) },
      { errors: [expect.anything()], data: { _: null } }
    ]
  ])('%s', async (_, typeDefs, document, lambdaResponse, expectedResponse) => {
    const kraken = setupKrakenRuntime({ typeDefs });
    (lambdaMock.invoke as jest.Mock).mockReturnValueOnce({
      promise: () => Promise.resolve(lambdaResponse)
    });
    const response = await kraken.gqlExecute({ operationId: '1', document });
    expect(response).toEqual(expectedResponse);
  });
});
