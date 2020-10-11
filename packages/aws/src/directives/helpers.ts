export const isChainedDirective = (field, directive) => {
  return field.astNode.directives.findIndex(d => d.name.value === directive.name) > 0;
};
