import { GraphQLModule, ModuleSessionInfo } from '@graphql-modules/core';

const wsSubscriptionsTableName = process.env.WS_SUBSCRIPTIONS_TABLE as string;

const getSubscriptionNameAndVariables = (triggerName: string, options: any) => {
  return null;
};

export class BlockingPubSub {
  constructor(private sessionInfo: ModuleSessionInfo) {
  }

  async subscribe(triggerName: string, options: any) {
    const { connectionId, subscriptionId, callbackUrl } = this.sessionInfo.context;
    const { subscriptionName, variables } = getSubscriptionNameAndVariables(triggerName, options);

  }

  async publish(triggerName: string, payload: any) {
  }

  async unsubscribe(subId: number) {
  }
}

export const blockingPubSub = new GraphQLModule({
  providers: [{ provide: 'PubSub', useClass: BlockingPubSub }]
});
