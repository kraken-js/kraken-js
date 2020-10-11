import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLError } from 'graphql';
import { isChainedDirective } from './helpers';

const stage = process.env.STAGE as string;
const service = process.env.SERVICE as string;

class AwsLambdaInvokeError extends GraphQLError {
  constructor(Payload) {
    const { errorType, errorMessage } = JSON.parse(Payload as string);
    super(errorMessage, undefined, null, null, null, null, { code: errorType });
  }
}

const getFunctionName = (name: string) => {
  if (name.startsWith('$')) return name.slice(1);
  return `${service}-${stage}-${name}`;
};

const makeSerializableContext = $context => {
  return Object.entries($context).reduce((result, [key, value]) => {
    if (key.startsWith('$')) return result;
    if (typeof value === 'function') return result;
    result[key] = value;
    return result;
  }, {});
};

export class AwsLambdaDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const shouldParse = this.args.shouldParse;
    const invocationType = this.args.invocationType;
    const functionName = getFunctionName(this.args.name);
    const isChained = isChainedDirective(field, this);

    field.resolve = async (source, args, $context, info) => {
      const context = makeSerializableContext($context);

      const { Payload, FunctionError } = await $context.$lambda
        .invoke({
          FunctionName: functionName,
          InvocationType: invocationType,
          Payload: JSON.stringify({ source, args, context, info })
        })
        .promise();

      if (FunctionError) throw new AwsLambdaInvokeError(Payload);

      if (isChained) {
        const response = JSON.parse(Payload as string);
        return await resolve.apply(this, [
          response?.source || source,
          response?.args || args,
          $context,
          info
        ]);
      }
      if (shouldParse) {
        return Payload ? JSON.parse(Payload as string) : null;
      }
      return Payload;
    };
  }
}
