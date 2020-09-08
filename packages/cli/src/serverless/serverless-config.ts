export default {
  plugins: [
    'serverless-webpack',
    'serverless-offline',
    'serverless-pseudo-parameters'
  ],
  custom: {
    webpack: {
      packager: 'yarn'
    },
    'serverless-offline': {
      noPrependStageInUrl: true,
      httpPort: 4000,
      websocketPort: 4001,
      lambdaPort: 4002,
      useChildProcesses: true
    },
    environment: {
      offline: {
        IS_OFFLINE: true
      }
    }
  },
  package: {
    individually: true
  }
};
