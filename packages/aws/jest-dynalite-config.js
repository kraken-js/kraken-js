module.exports = {
  tables: [
    {
      TableName: 'WsSubscriptions-test',
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
    }
  ],
  basePort: 5002
};
