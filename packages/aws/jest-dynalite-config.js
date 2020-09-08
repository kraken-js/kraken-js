module.exports = {
  tables: [
    {
      TableName: 'WsSubscriptions-test',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'connectionId', AttributeType: 'S' },
        { AttributeName: 'subscriptionId', AttributeType: 'S' },
        { AttributeName: 'triggerName', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'connectionId', KeyType: 'HASH' },
        { AttributeName: 'subscriptionId', KeyType: 'RANGE' }
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
  basePort: 8007
};
