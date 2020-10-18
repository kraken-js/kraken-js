import { krakenJs } from '@kraken.js/core';
import { graphqlSchema as krakenJsAws } from '@kraken.js/aws';
import { eventsSchema as krakenJsAwsEventsSchema } from '@kraken.js/aws';
import { graphqlSchema as krakenJsDemo } from '@kraken.js/demo';

export const krakenSchema = krakenJs([
	krakenJsAws(),
	krakenJsAwsEventsSchema(),
	krakenJsDemo
]);
