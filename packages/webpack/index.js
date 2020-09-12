module.exports = {
  default: require('./src/webpack.commons.js'),
  forModule: require('./src/webpack.commons-module.js'),
  forServerless: require('./src/webpack.commons-serverless.js')
};
