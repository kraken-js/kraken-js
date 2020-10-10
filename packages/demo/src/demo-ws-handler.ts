import { wsHandler } from '@kraken.js/aws';
import { krakenSchema } from './schema';

export const handler = wsHandler(krakenSchema);
