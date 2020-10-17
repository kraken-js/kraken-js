import { dynamodbStreamsHandler } from '@kraken.js/aws';
import { Injector, krakenJs } from '@kraken.js/core';

const publishMock = jest.fn(() => Promise.resolve());
const mockSchema = {
  plugins(inject: Injector) {
    inject('pubsub', {
      publish: publishMock
    });
  }
};

describe('DynamoDB Streams Handler', () => {
  it('should ', async () => {
    const kraken = krakenJs([mockSchema]);
    await dynamodbStreamsHandler(kraken, { triggerName: 'onMessages#{channel}', typeName: 'Message' })({
      Records: [
        {
          eventName: 'INSERT',
          dynamodb: {
            ApproximateCreationDateTime: 1000,
            Keys: { channel: { S: 'general' }, message: { S: 'hello world' } }
          }
        },
        {
          eventName: 'MODIFY',
          dynamodb: {
            ApproximateCreationDateTime: 1001,
            NewImage: { channel: { S: 'general' }, message: { S: 'hello world (edited)' } }
          }
        },
        {
          eventName: 'REMOVE',
          dynamodb: {
            ApproximateCreationDateTime: 1002,
            NewImage: { channel: { S: 'random' } }
          }
        }
      ]
    });

    expect(publishMock).toHaveBeenCalledWith('onMessages#{channel}', {
      __created: true,
      __timestamp: 1000,
      __typename: 'Message',
      channel: 'general',
      message: 'hello world'
    });
    expect(publishMock).toHaveBeenCalledWith('onMessages#{channel}', {
      __updated: true,
      __timestamp: 1001,
      __typename: 'Message',
      channel: 'general',
      message: 'hello world (edited)'
    });
    expect(publishMock).toHaveBeenCalledWith('onMessages#{channel}', {
      __deleted: true,
      __timestamp: 1002,
      __typename: 'Message',
      channel: 'random'
    });
  });
});
