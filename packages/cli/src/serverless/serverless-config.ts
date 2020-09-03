export default {
  plugins: [
    'serverless-webpack',
    'serverless-offline',
    'serverless-pseudo-parameters'
  ],
  custom: {
    account: '#{AWS::AccountId}',
    region: '${self:provider.region}',
    stage: '${self:provider.stage}',
    prefix: '${self:service.name}-${self:custom.stage}',
    lambda: {
      arnPrefix: 'arn:aws:lambda:${self:custom.region}:${self:custom.account}:function:${self:service.name}-${self:custom.stage}'
    },
    cors: {
      origin: '*',
      maxAge: 86400,
      cacheControl: 'max-age=86400',
      headers: ['Content-Type', 'Authorization', 'Range']
    },
    webpack: {
      packager: 'yarn',
      includeModules: { forceExclude: ['aws-sdk'] }
    },
    'serverless-offline': {
      noPrependStageInUrl: true,
      httpPort: 4000,
      websocketPort: 4001,
      lambdaPort: 4002,
      useChildProcesses: true
    },
    environment: {
      default: {
        STAGE: '${self:custom.stage}',
        REGION: '${self:custom.region}',
        SERVICE: '${self:service.name}',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: 1
      },
      offline: {
        IS_OFFLINE: true
      }
    }
  },
  package: {
    individually: true
  },
  provider: {
    name: 'aws',
    runtime: 'nodejs12.x',
    timeout: 10,
    memorySize: 256,
    stage: '${opt:stage, \'dev\'}',
    versionFunctions: false,
    logRetentionInDays: 7,
    iamRoleStatements: [{
      Effect: 'Allow',
      Action: ['lambda:InvokeAsync', 'lambda:InvokeFunction'],
      Resource: '*'
    }],
    stackTags: {
      SERVICE: '${self:service}',
      STAGE: '${self:custom.stage}',
      REGION: '${self:custom.region}',
      VERSION: '${file(package.json):version}'
    }
  }
};
