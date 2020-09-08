# @kraken.js

Real Serverless Graphql Experience with Realtime Support!

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
yarn offline

offline: Starting Offline: offline/us-east-1.
offline: Offline [http for lambda] listening on http://localhost:4002
offline: route '$connect'
offline: route '$disconnect'
offline: route '$default'
offline: Offline [websocket] listening on ws://localhost:4001
offline: Offline [http for websocket] listening on http://localhost:4001
```

## In Action

The websocket protocol implementation is based on https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md

```sh
wscat --connect ws://localhost:4001
> {"type":"connection_init"}
< {"type":"connection_ack"}
> {"type":"start", "id":1, "payload":{"query":"query { systemInfo { region }}"}}
< {"id":1,"type":"data","payload":{"data":{"systemInfo":{"region":"us-east-1"}}}}
< {"id":1,"type":"complete"}
```
