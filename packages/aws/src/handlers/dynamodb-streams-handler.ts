import { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const getItem = (record: DynamoDBRecord) => {
  if (record.dynamodb?.NewImage) return DynamoDB.Converter.unmarshall(record.dynamodb?.NewImage as any);
  if (record.dynamodb?.OldImage) return DynamoDB.Converter.unmarshall(record.dynamodb?.OldImage as any);
  if (record.dynamodb?.Keys) return DynamoDB.Converter.unmarshall(record.dynamodb?.Keys as any);
};

interface DynamodbStreamsOptions {
  triggerName: string;
  typeName?: string;
}

export const dynamodbStreamsHandler = (kraken: Kraken.Runtime, options: DynamodbStreamsOptions) => {
  return async (event: DynamoDBStreamEvent) => {
    for (const record of event.Records) {
      const item = getItem(record);

      await kraken.$pubsub.publish(options.triggerName, {
        __typename: options.typeName,
        __created: record.eventName === 'INSERT' ? true : undefined,
        __updated: record.eventName === 'MODIFY' ? true : undefined,
        __deleted: record.eventName === 'REMOVE' ? true : undefined,
        __timestamp: record.dynamodb?.ApproximateCreationDateTime,
        ...item
      }).catch(error => {
        // silent failure to avoid re-processing
        console.error(error);
      });
    }
  };
};
