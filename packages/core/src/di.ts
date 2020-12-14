type Serializable = {
  toJSON: () => any
}

type EachReturnType<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => infer U ? U : T[K];
}

type Container<T, R> = T & EachReturnType<R> & Serializable;
type ContainerFactory<R> = <T>(ctx?: T) => Container<T, R>;

export const containerFactory = <P>($plugins: P): ContainerFactory<P> => {

  return <T>(seed: T = {} as T): Container<T, P> => {
    const instances = {};

    Object.getOwnPropertyNames($plugins).forEach(plugin => {
      if (seed[plugin] === undefined) {
        Object.defineProperty(seed, plugin, (() => {
          const stack = [];

          const getter = () => {
            if (instances[plugin]) {
              return instances[plugin];
            }

            if (stack.includes(plugin)) {
              throw new Error('Circular dependency detected');
            }

            if (typeof $plugins[plugin] === 'function') {
              stack.push(plugin);
              instances[plugin] = $plugins[plugin](seed);
              stack.pop();
            } else {
              instances[plugin] = $plugins[plugin];
            }

            return instances[plugin];
          };

          return {
            get: getter
          };
        })());
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

    return seed as Container<T, P>;
  };
};
