import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLError } from 'graphql';

const getValue = (from: any, field: string) =>
  field && from ? field.split('.').reduce((o, f) => (o ? o[f] : undefined), from) : undefined;

const doCrox = (v1, v2) => {
  if (!v1 || !v2) return false;
  if (v1 === v2) return true;

  if (Array.isArray(v1)) {
    if (Array.isArray(v2)) return v1.some(v => v2.includes(v));
    return v1.includes(v2);
  }
  if (Array.isArray(v2)) return v2.includes(v1);

  return false;
};

const authorizes = (rule: Rule, source, args, authorizer) => {
  const fromArgs = getValue(args, rule.args);
  const fromSource = getValue(source, rule.source);
  const fromAuthorizer = getValue(authorizer, rule.authorizer);

  if (rule.truthy) {
    return !!fromSource || !!fromAuthorizer;
  }
  if (rule.match) {
    if (!!fromArgs) return doCrox(fromArgs, rule.match);
    if (!!fromSource) return doCrox(fromSource, rule.match);
    if (!!fromAuthorizer) return doCrox(fromAuthorizer, rule.match);
    return false;
  }

  return doCrox(fromSource, fromAuthorizer) || doCrox(fromArgs, fromAuthorizer);
};

type Rule = {
  args: string;
  source: string;
  authorizer: string;
  match: string[];
  truthy: boolean;
};

const unauthorizedError = () => new GraphQLError('Unauthorized', undefined, null, null, null, null, { code: 401 });

export class AuthDirective extends SchemaDirectiveVisitor {
  visitObject(object) {
    const fields = Object.values(object.getFields());
    fields.forEach(field => this.visitFieldDefinition(field));
  }

  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const silent = this.args.silent;
    const allRules = this.args.rules as Rule[];
    const preRules = allRules.filter(rule => !rule.source);
    const postRules = allRules.filter(rule => !!rule.source);

    const throwOrNot = () => {
      if (!silent) throw unauthorizedError();
    };

    field.resolve = (source, args, context, info) => {
      const auth = context.authorizer;

      const preAuthorized = () => !preRules.length || preRules.some(rule => authorizes(rule, source, args, auth));
      if (!preAuthorized()) return throwOrNot();

      // this means authorizing a query (no source)
      // so first resolve the query then evaluate it as source
      const noSource = !source;
      if (noSource) source = resolve.call(this, source, args, context, info);

      const postAuthorized = () => !postRules.length || postRules.some(rule => authorizes(rule, source, args, auth));
      if (!postAuthorized()) return throwOrNot();

      return noSource ? source : resolve.call(this, source, args, context, info);
    };
  }
}
