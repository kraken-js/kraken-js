module.exports = {
  graphql: [
    ['@kraken.js/aws', {
      offline: {
        lambdaConfig: {
          apiVersion: '2015-03-31',
          endpoint: 'http://127.0.0.1:4002'
        },
        apiGatewayConfig: {
          endpoint: 'http://127.0.0.1:4001'
        },
        dynamoDbConfig: {
          endpoint: 'http://127.0.0.1:5002'
        }
      }
    }],
    '@kraken.js/aws:events-schema',
    '@kraken.js/demo'
  ]
};
