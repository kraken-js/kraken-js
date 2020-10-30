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
  it('should publish messages for each trigger name and call forEach', async () => {
    const kraken = krakenJs([mockSchema]);
    const forEach = jest.fn();
    await dynamodbStreamsHandler(kraken, {
      triggerNames: ['onMessages#{channel}', 'onMessages#{sentBy}'],
      typeName: 'Message'
    }, forEach)({
      Records: [
        {
          eventName: 'INSERT',
          dynamodb: {
            ApproximateCreationDateTime: 1000,
            Keys: { channel: { S: 'general' }, sentBy: { S: 'me' }, message: { S: 'hello world' } }
          }
        },
        {
          eventName: 'MODIFY',
          dynamodb: {
            ApproximateCreationDateTime: 1001,
            NewImage: { channel: { S: 'general' }, sentBy: { S: 'me' }, message: { S: 'hello world (edited)' } }
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
      sentBy: 'me',
      message: 'hello world'
    });
    expect(publishMock).toHaveBeenCalledWith('onMessages#{sentBy}', {
      __created: true,
      __timestamp: 1000,
      __typename: 'Message',
      channel: 'general',
      sentBy: 'me',
      message: 'hello world'
    });
    expect(publishMock).toHaveBeenCalledWith('onMessages#{channel}', {
      __updated: true,
      __timestamp: 1001,
      __typename: 'Message',
      channel: 'general',
      sentBy: 'me',
      message: 'hello world (edited)'
    });
    expect(publishMock).toHaveBeenCalledWith('onMessages#{sentBy}', {
      __updated: true,
      __timestamp: 1001,
      __typename: 'Message',
      channel: 'general',
      sentBy: 'me',
      message: 'hello world (edited)'
    });
    expect(publishMock).toHaveBeenCalledWith('onMessages#{channel}', {
      __deleted: true,
      __timestamp: 1002,
      __typename: 'Message',
      channel: 'random'
    });
    expect(publishMock).toHaveBeenCalledWith('onMessages#{sentBy}', {
      __deleted: true,
      __timestamp: 1002,
      __typename: 'Message',
      channel: 'random'
    });

    expect(forEach).toHaveBeenCalledTimes(3);
  });
});
