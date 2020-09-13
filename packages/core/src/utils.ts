export const pushToArray = (array, value) => {
  if (value) {
    if (Array.isArray(value)) {
      array.push(...value);
    } else {
      array.push(value);
    }
  }
};
