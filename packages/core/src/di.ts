type Serializable = {
  toJSON: () => any
}

type EachReturnType<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => infer U ? U : T[K];
}

type Injector<T, R> = T & EachReturnType<R> & Serializable;
type Container<R> = <T>(ctx?: T) => Injector<T, R>;

export const containerFactory = <P>($plugins: P): Container<P> => {

  return <T>(seed: T = {} as T): Injector<T, P> => {
    const instances = {};
    const stack = [];

    Object.getOwnPropertyNames($plugins).forEach(plugin => {
      if (seed[plugin] === undefined) {
        Object.defineProperty(seed, plugin, {
          get() {
            if (instances[plugin]) {
              return instances[plugin];
            }

            if (stack.includes(plugin)) {
              throw new Error('Circular dependency detected: ' + stack.concat(plugin).reverse().join(' <~ '));
            }

            if (typeof $plugins[plugin] === 'function') {
              stack.push(plugin);
              instances[plugin] = $plugins[plugin](seed);
              stack.pop();
            } else {
              instances[plugin] = $plugins[plugin];
            }

            return instances[plugin];
          }
        });
      }
    });

    (seed as any).toJSON = () => {
      return Object.entries(seed).reduce((result, [key, value]) => {
        if (typeof value === 'function') {
          return result;
        }

        result[key] = value;
        return result;
      }, {});
    };

    return seed as Injector<T, P>;
  };
};
