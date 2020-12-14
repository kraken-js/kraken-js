import { dynamoDbDataLoader } from '@kraken.js/aws/src/schemas/core';
import 'jest-dynalite/withDb';

import { dynamoDb } from './directives/helpers';

describe('DDB Data Loader', () => {
  const loader = dynamoDbDataLoader({ $dynamoDb: dynamoDb } as any);

  const m1 = { channel: 'general', timestamp: '10000', message: 'hi', sentBy: 'u1', hasEmoji: false };
  const m2 = { channel: 'general', timestamp: '11000', message: 'hello :)', sentBy: 'u2', hasEmoji: true };
  const m3 = { channel: 'general', timestamp: '11100', message: 'how are you?', sentBy: 'u2', hasEmoji: false };
  const m4 = { channel: 'random', timestamp: '11110', message: 'hey', sentBy: 'u2', hasEmoji: true };

  beforeEach(async () => {
    for (const message of [m1, m2, m3, m4]) {
      await dynamoDb.put({
        TableName: 'Message-test-stage',
        Item: message
      }).promise();
    }
  });


  it('should load item by key', async () => {
    const actual = await loader.load({
      TableName: 'Message-test-stage',
      Key: { channel: 'random', timestamp: '11110' }
    });

    expect(actual).toEqual(m4);
  });

  it('should load many items by key', async () => {
    const actual = await loader.loadMany([
      { TableName: 'Message-test-stage', Key: { channel: 'random', timestamp: '11110' } },
      { TableName: 'Message-test-stage', Key: { channel: 'general', timestamp: '11100' } },
      { TableName: 'Message-test-stage', Key: { channel: 'not.found', timestamp: '11100' } }
    ]);

    expect(actual).toEqual([m4, m3, null]);
  });

  it('should load cached item by key', async () => {
    const cached = { ...m1, cached: true };
    loader.prime({
      TableName: 'Message-test-stage',
      Key: { channel: 'general', timestamp: '10000' }
    }, cached);

    const actual = await loader.load({
      TableName: 'Message-test-stage',
      Key: { channel: 'general', timestamp: '10000' }
    });

    expect(actual).toEqual(cached);
  });
});
