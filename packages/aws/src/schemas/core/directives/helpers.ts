import {
  DirectiveNode,
  GraphQLField,
  GraphQLObjectType,
  isListType,
  isNonNullType,
  valueFromASTUntyped
} from 'graphql';

const stage = process.env.STAGE as string;
type GetDirectiveFrom = GraphQLObjectType | GraphQLField<any, any>;

export const isChainedDirective = (field, directive) => {
  return field.astNode.directives.findIndex(d => d.name.value === directive.name) > 0;
};

export const getTargetModelInfo = field => {
  const type = resolveVariableType(field.type);
  const model = getDirectiveByName(type, 'model');

  // not a model, maybe it's a connection type => { nodes: [Model] }
  if (!model) {
    const nodes = type.getFields().nodes;
    if (nodes) return getTargetModelInfo(nodes);
  }

  const defaultTableName = [type.name, stage].join('-');
  const {
    table = defaultTableName,
    timestamps = true
  } = getDirectiveArguments(model);

  return {
    tableName: table.replace('{stage}', stage),
    timestamps
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
