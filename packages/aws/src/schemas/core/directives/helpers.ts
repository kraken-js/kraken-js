import {
  DirectiveNode,
  GraphQLField,
  GraphQLObjectType,
  isListType,
  isNonNullType,
  valueFromASTUntyped
} from 'graphql';

type GetDirectiveFrom = GraphQLObjectType | GraphQLField<any, any>;

const stage = process.env.STAGE as string;
const operators = new Set([
  'or',
  'and',
  'eq',
  'lt',
  'lte',
  'gt',
  'gte',
  'not',
  'in',
  'nin',
  'contains',
  'exists',
  'beginsWith',
  'between',
  'set',
  'unset',
  'inc',
  'push',
  'addToSet',
  'unshift',
  'each'
]);

export const isChainedDirective = (field, directive) => {
  return field.astNode.directives.findIndex(d => d.name.value === directive.name) > 0;
};

export const getTargetModelInfo = field => {
  const isList = isListType(field.type);
  const type = resolveVariableType(field.type);
  const model = getDirectiveByName(type, 'model');

  // not a model, maybe it's a connection type => { nodes: [Model] } || { items: [Model] }
  if (!model) {
    const fields = type.getFields();
    const connection = (fields.nodes || fields.items);
    if (connection) {
      const response = getTargetModelInfo(connection);
      return { ...response, connection };
    }
  }

  const defaultTableName = [type.name, stage].join('-');
  const {
    table = defaultTableName,
    timestamp = true,
    versioned = false,
    partitionKey = 'id',
    sortKey
  } = getDirectiveArguments(model);

  return {
    tableName: table.replace('{stage}', stage),
    timestamp,
    versioned,
    partitionKey,
    sortKey,
    isList
  };
};

export const resolveVariableType = type => {
  if (isListType(type)) return resolveVariableType(type.ofType);
  if (isNonNullType(type)) return resolveVariableType(type.ofType);
  return type;
};

export const getDirectiveByName = (object: GetDirectiveFrom, directiveName: string): DirectiveNode | undefined => {
  return object.astNode?.directives?.find(directive => directive.name.value === directiveName);
};

export const getDirectiveArguments = <T>(directive: DirectiveNode | undefined): T => {
  return directive?.arguments?.reduce((args, arg) => {
    args[arg.name.value] = valueFromASTUntyped(arg.value);
    return args;
  }, {} as T) || {} as T;
};

export const getMapping = (source: any, fields?: string[], mapper = (source, from) => source[from]) => {
  return fields?.reduce((values, field: string) => {
    const [from, to] = field.split(':');
    values[to || from] = mapper(source, from);
    return values;
  }, {});
};

export const prefixOperatorsWith$ = (object = {}): any => {
  if (object === null || object === undefined) {
    return object;
  }
  if (Array.isArray(object)) {
    const result: any[] = [];
    for (const each of object) {
      result.push(typeof each === 'object' ? prefixOperatorsWith$(each) : each);
    }
    return result;
  }

  const result = {};
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      const value = object[key];
      if (operators.has(key)) {
        result['$' + key] = typeof value === 'object' ? prefixOperatorsWith$(value) : value;
      } else if (typeof value === 'object') {
        result[key] = prefixOperatorsWith$(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
};

export const toBase64 = object => {
  if (!object) return undefined;
  const b = new Buffer(JSON.stringify(object));
  return b.toString('base64');
};

export const fromBase64 = (string, parse = true) => {
  if (!string) return undefined;
  const s = new Buffer(string, 'base64').toString();
  return parse ? JSON.parse(s) : s;
};

