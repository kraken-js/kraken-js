import { EventBridgeHandler } from 'aws-lambda';

export const handler: EventBridgeHandler<'Ping', any, any> = (event) => {
  console.log(event);
};
