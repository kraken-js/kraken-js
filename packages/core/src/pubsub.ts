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

const submitJobs = (jobs: (() => Promise<any>)[], concurrency = 25) => {
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

export const krakenPubSub = () =>
  (context: Kraken.ExecutionContext): PubSub => ({
    async publish(triggerName: string, payload: any) {
      const interpolatedTriggerName = interpolate(triggerName, payload); // onMessage#{channel} => onMessage#general
      const subscriptionName = triggerName.split('#')[0]; // onMessage#{channel} => onMessage

      const subscriptions = await context.$subscriptions.findByTriggerName(interpolatedTriggerName);
      const jobs = subscriptions.map(subscription => {
        return async () => await context.$connections.send(subscription, {
          id: subscription.operationId,
          type: GQL_DATA,
          payload: { data: { [subscriptionName]: payload } }
        });
      });

      await submitJobs(jobs);
    },

    async subscribe(triggerName: string, vars?: Record<string, any>) {
      const interpolatedTriggerName = interpolate(triggerName, vars); // onMessage#{channel} => onMessage#general
      const $vars = variables(vars);
      return await context.$subscriptions.save({
        ...context.connectionInfo,
        operationId: context.operationId,
        triggerName: interpolatedTriggerName,
        ...$vars
      });
    }
  });
