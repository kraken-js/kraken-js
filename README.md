# @kraken.js

Real Serverless Graphql Experience with Realtime Powers!

## Instalation

```sh
npm i -g @kraken.js/cli
```

## Usage

```sh
kraken new [--name|--version]
```

```sh
cd {name}
yarn dev

offline: Starting Offline: offline/us-east-1.
offline: Offline [http for lambda] listening on http://localhost:4002
offline: route '$connect'
offline: route '$disconnect'
offline: route '$default'
offline: Offline [websocket] listening on ws://localhost:4001
offline: Offline [http for websocket] listening on http://localhost:4001
```

## In Action

Check the [demo](packages/demo) project

The websocket protocol implementation is based on [Apollo subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md)

With this simple schema and an even simpler resolver

```graphql
type Subscription {
    onPing(channel: String): Ping @sub(triggerName: "onPing#{channel}")
}

type Mutation {
    ping(channel: String!): Ping @pub(triggerNames: ["onPing#{channel}"])
}

type Ping {
    channel: String!
    timestamp: Float!
}
```

```ts
{
    Mutation: {
      ping: (_, args) => ({
        ...args,
        timestamp: Date.now()
      })
    }
  }
```

...and you are ready to use pubsub on serverless

```sh
wscat --connect ws://localhost:4001
# initialize the connection (required)
> {"type":"connection_init"}
< {"type":"connection_ack"}

# start a subscription
> {"type":"start", "id": "1", "payload":{"query":"subscription { onPing(channel: \"global\") }"}}

# publish to the subscription
> {"type":"start", "id": "2", "payload":{"query":"mutation { ping(channel: \"global\") { channel timestamp } }"}}

# subscription response
< {"id":"1","type":"data","payload":{"data":{"onPing":{"channel":"global","timestamp":1599781288309,"__typename":"Ping"}}}}

# mutation response
< {"id":"2","type":"data","payload":{"data":{"ping":{"channel":"global","timestamp":1599781288309}}}} # mutation response
< {"id":"2","type":"complete"}
```
