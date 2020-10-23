export const executionContextBuilder = ($plugins: Kraken.Context) => {
  return <T>(ctx: T): T & Kraken.ExecutionContext => {
    Object.getOwnPropertyNames($plugins).forEach(plugin => {
      const $ = { [plugin]: $plugins[plugin] };
      if (ctx[plugin] === undefined) {
        Object.defineProperty(ctx, plugin, {
          get() {
            if (typeof $[plugin] === 'function') {
              $[plugin] = $[plugin](ctx);
            }
            return $[plugin];
          }
        });
      }
    });
    (ctx as any).serialize = () => {
      return Object.entries(ctx).reduce((result, [key, value]) => {
        if (typeof value === 'function') return result;
        result[key] = value;
        return result;
      }, {});
    };
    return ctx as T & Kraken.ExecutionContext;
  };
};
