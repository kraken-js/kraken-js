import { KrakenRuntime } from '@kraken.js/core';
import { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const getItem = (record: DynamoDBRecord) => {
  if (record.dynamodb?.NewImage) return DynamoDB.Converter.unmarshall(record.dynamodb?.NewImage as any);
  if (record.dynamodb?.OldImage) return DynamoDB.Converter.unmarshall(record.dynamodb?.OldImage as any);
};

interface DynamodbStreamsOptions {
  triggerName: string;
  typeName?: string;
}

export const dynamodbStreamsHandler = (kraken: KrakenRuntime, options: DynamodbStreamsOptions) => {
  return async (event: DynamoDBStreamEvent) => {
    await Promise.all(event.Records.map(record => {
      const item = getItem(record);

      return kraken.$pubsub.publish(options.triggerName, {
        __typename: options.typeName,
        __created: record.eventName === 'INSERT' ? true : undefined,
        __updated: record.eventName === 'MODIFY' ? true : undefined,
        __deleted: record.eventName === 'REMOVE' ? true : undefined,
        __timestamp: record.dynamodb?.ApproximateCreationDateTime,
        ...item
      });
    })).catch(error => {
      // silent failure to avoid re-processing
      console.error(error);
    });
  };
};
