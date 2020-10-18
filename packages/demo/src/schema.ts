import { krakenJs, getStageConfig } from '@kraken.js/core';
import { graphqlSchema as krakenJsAws } from '@kraken.js/aws';
import { eventsSchema as krakenJsAwsEventsSchema } from '@kraken.js/aws';
import { graphqlSchema as krakenJsDemo } from '@kraken.js/demo';

export const krakenSchema = krakenJs([
	krakenJsAws(getStageConfig({"offline":{"lambdaConfig":{"apiVersion":"2015-03-31","endpoint":"http://127.0.0.1:4002"},"apiGatewayConfig":{"endpoint":"http://127.0.0.1:4001"},"dynamoDbConfig":{"endpoint":"http://127.0.0.1:5002"}}})),
	krakenJsAwsEventsSchema(),
	krakenJsDemo
]);
