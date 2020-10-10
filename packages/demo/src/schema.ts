import { krakenJs } from '@kraken.js/core';
import { graphqlSchema as krakenJsAws } from '@kraken.js/aws';
import { demoSchema as krakenJsDemo } from '@kraken.js/demo';

export const krakenSchema = krakenJs([
  krakenJsAws(),
  krakenJsDemo
]);
