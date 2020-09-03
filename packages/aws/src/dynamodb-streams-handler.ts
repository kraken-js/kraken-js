import { Subscription, SubscriptionManager } from '@kraken.js/core';
import { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { dynamoDbSubscriptionManager } from './dynamodb-managers';

const getItem = (record: DynamoDBRecord) => {
  if (record.dynamodb?.NewImage) return DynamoDB.Converter.unmarshall(record.dynamodb?.NewImage as any);
  if (record.dynamodb?.OldImage) return DynamoDB.Converter.unmarshall(record.dynamodb?.OldImage as any);
};

interface DynamodbStreamsHandlerParams {
  triggerName: string;
  typeName?: string;
  subscriptions?: SubscriptionManager<Subscription>;
}

/**
 * For each item received on DynamoDB Events Streams publishes it to subscriptions listening on that channel (triggerName)
 *
 * e.g.:
 * ```
 * export const handler = dynamodbStreamsHandler('onMessage#{chatId}', 'ChatMessage');
 * ```
 *
 * @param triggerName onMessage#{chatId} trigger name with interpolation on payload
 * @param typeName ChatMessage this is the __typename metadata sent to subscribers
 * @param subscriptions SubscriptionManager for querying subscriptions
 */
export const dynamodbStreamsHandler = ({ triggerName, typeName, subscriptions }: DynamodbStreamsHandlerParams) => {
  if (!subscriptions) subscriptions = dynamoDbSubscriptionManager();

  return async (event: DynamoDBStreamEvent) => {
    await Promise.all(event.Records.map(record => {
      const item = getItem(record);
      return subscriptions?.publish(triggerName, {
        __metadata: {
          __typename: typeName,
          __created: record.eventName === 'INSERT' ? true : undefined,
          __updated: record.eventName === 'MODIFY' ? true : undefined,
          __deleted: record.eventName === 'REMOVE' ? true : undefined,
          __timestamp: record.dynamodb?.ApproximateCreationDateTime
        },
        ...item
      });
    })).catch(error => {
      // silent failure to avoid re-processing
      console.error(error);
    });
  };
};
