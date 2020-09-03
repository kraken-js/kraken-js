import { Connection, Subscription } from '@kraken.js/core';

export type AwsConnection<T> = Connection<T> & {
  apiGatewayUrl: string
  connectedAt?: number
}

export type AwsConnectionInfo<T> = Pick<AwsConnection<T>, 'connectionId' | 'apiGatewayUrl'>

export type AwsSubscription = Subscription & {
  apiGatewayUrl: string
}
