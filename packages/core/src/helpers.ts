export const deepMerge = (...args): any => {
  const result = {};
  const merge = obj => {
    for (const prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        // If property is an object, merge properties
        if (Object.prototype.toString.call(obj[prop]) === '[object Object]') {
          result[prop] = deepMerge(result[prop], obj[prop]);
        } else {
          result[prop] = obj[prop];
        }
      }
    }
  };
  for (let i = 0; i < args.length; i++) {
    args[i] && merge(args[i]);
  }

  return result;
};
