import AWS, { EventBridge } from 'aws-sdk';

export type AwsEventsSchemaConfig = {
  eventBridge?: EventBridge
  eventBridgeConfig?: AWS.EventBridge.Types.ClientConfiguration
}

