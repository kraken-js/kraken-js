const JSONParse = JSON.parse;
JSON.parse = function(text, reviver) {
  try {
    return JSONParse(text, reviver)
  } catch (e) {
    throw new Error(`JSON.parse failed to parse "${text}"`)
  }
};
