module.exports = {
  tables: [
    {
      TableName: 'WsSubscriptions-test-stage',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'connectionId', AttributeType: 'S' },
        { AttributeName: 'operationId', AttributeType: 'S' },
        { AttributeName: 'triggerName', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'connectionId', KeyType: 'HASH' },
        { AttributeName: 'operationId', KeyType: 'RANGE' }
      ],
      GlobalSecondaryIndexes: [{
        IndexName: 'byTriggerName',
        KeySchema: [
          { AttributeName: 'triggerName', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }]
    },

    {
      TableName: 'Model-test-stage',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ]
    },

    {
      TableName: 'Message-test-stage',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'channel', AttributeType: 'S' },
        { AttributeName: 'sentBy', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'channel', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' }
      ],
      GlobalSecondaryIndexes: [{
        IndexName: 'bySentBy',
        KeySchema: [
          { AttributeName: 'sentBy', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }]
    },

    {
      TableName: 'ExistingTable',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ]
    }
  ],
  basePort: 5002
};
