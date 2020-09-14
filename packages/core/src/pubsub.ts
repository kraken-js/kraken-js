import { parse, print } from 'graphql';
import { GQL_DATA } from './constants';
import { PubSub } from './types';

const variablesPrefix = '$';

const interpolate = (string: string, vars: any = {}) => {
  return string.replace(/{(.*?)}/g, (match, offset) => vars[offset] || '');
};

const variables = (value: any = {}) => Object.entries(value)
  .reduce((vars, [key, value]) => {
    if (value !== undefined) {
      vars[variablesPrefix + key] = value;
    }
    return vars;
  }, {});

const submitJobs = (jobs: (() => Promise<any>)[], concurrency = 100) => {
  let workers = 0;
  let index = 0;

  return new Promise(done => {
    const finished = index => result => {
      jobs[index] = result;
      workers--;
      tick();
    };
    const tick = () => {
      if (workers < concurrency && index < jobs.length) {
        jobs[index]().then(finished(index)).catch(finished(index));
        ++index && ++workers;
        tick();
      } else if (workers === 0 && index === jobs.length) {
        done(jobs);
      }
    };
    tick();
  });
};

export class KrakenPubSub implements PubSub {
  constructor(protected context: Kraken.ExecutionContext) {
  }

  async subscribe(triggerName: string, vars?: Record<string, any>) {
    if (this.context.$subMode === 'OUT') {
      // skip storing the subscription as it's in OUT mode, sending message
      return;
    }

    const interpolatedTriggerName = interpolate(triggerName, vars); // onMessage#{channel} => onMessage#general
    return await this.context.$subscriptions.save({
      ...this.context.connectionInfo,

      operationId: this.context.operation.id,
      document: print(this.context.operation.document),
      operationName: this.context.operation.operationName,
      variableValues: this.context.operation.variableValues,

      triggerName: interpolatedTriggerName,
      ...variables(vars)
    });
  }

  async publish(triggerName: string, payload: any) {
    if (this.context.$pubStrategy === 'BROADCASTER') {
      if (this.context.$broadcaster) {
        return await this.context.$broadcaster.broadcast(triggerName, payload);
      }
    }

    const interpolatedTriggerName = interpolate(triggerName, payload);
    const subscriptions = await this.context.$subscriptions.findByTriggerName(interpolatedTriggerName);
    const jobs = subscriptions.map(subscription => this.sendJob(subscription, payload));
    await submitJobs(jobs);
  }

  private sendJob(subscription: Kraken.Subscription, payload: any) {
    return async () => {
      // GRAPHQL runs the subscription operation with $pubsubMode: OUT and send the response to the connection
      if (this.context.$pubStrategy === 'GRAPHQL') {
        const response = await this.context.gqlExecute({
          rootValue: payload,
          connectionInfo: subscription,
          operationId: subscription.operationId,
          document: parse(subscription.document),
          operationName: subscription.operationName,
          variableValues: subscription.variableValues,
          contextValue: {
            $subMode: 'OUT'
          }
        });
        return await this.context.$connections.send(subscription, {
          id: subscription.operationId,
          type: GQL_DATA,
          payload: response
        });
      }

      // AS_IS tries to guess the subscriptionName from the triggerName and just sends the payload AS IS
      const [subscriptionName] = subscription.triggerName.split('#');
      return await this.context.$connections.send(subscription, {
        id: subscription.operationId,
        type: GQL_DATA,
        payload: { data: { [subscriptionName]: payload } }
      });
    };
  }
}

export const krakenPubSub = () => (context: Kraken.ExecutionContext): PubSub => {
  return new KrakenPubSub(context);
};