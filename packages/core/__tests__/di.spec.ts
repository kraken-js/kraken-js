import { containerFactory } from '@kraken.js/core/src/di';

describe('Dependency Injection', () => {
  const factory = containerFactory({
    hello: 'hello world',
    bye: { world: 1 },
    $hey() {
      const random = Math.random();
      return { ho: () => 'lets go', random };
    },
    $ramones({ $hey }) {
      return { ho: () => $hey.ho() + ' says Ramones', random: $hey.random };
    },
    $rollingStones({ $likeARollingStone }) {
      return { name: 'Rolling Stones', song: $likeARollingStone.name };
    },
    $likeARollingStone({ $rollingStones }) {
      return { name: 'Like a Rolling Stone', band: $rollingStones.name };
    }
  });

  it('should resolver simple string dependency by name', () => {
    const actual = factory().hello;
    expect(actual).toEqual('hello world');
  });

  it('should resolver simple object dependency by name', () => {
    const actual = factory().bye;
    expect(actual).toEqual({ world: 1 });
  });

  it('should resolver dependency by name', () => {
    const actual = factory().$hey.ho();
    expect(actual).toEqual('lets go');
  });

  it('should resolve different instances', () => {
    const random1 = factory().$hey.random;
    const random2 = factory().$hey.random;
    expect(random1).not.toEqual(random2);
  });

  it('should resolve same instance multiple times', () => {
    const container = factory();
    const random1 = container.$hey.random;
    const random2 = container.$hey.random;
    const random3 = container.$hey.random;
    expect(random1).toEqual(random2);
    expect(random2).toEqual(random3);
  });

  it('should inject resolved dependencies', () => {
    const actual = factory().$ramones.ho();
    expect(actual).toEqual('lets go says Ramones');
  });

  it('should inject same dependency ', () => {
    const container = factory();
    const fromHey = container.$hey.random;
    const fromRamones = container.$ramones.random;
    expect(fromHey).toEqual(fromRamones);
  });

  it('should detect circular dependency ', () => {
    try {
      const name = factory().$rollingStones.name;
      fail(name);
    } catch (e) {
      expect(e.message).toEqual('Circular dependency detected');
    }
  });

  it('toJSON should make ctx serializable ', () => {
    const json = factory({ hello: 1 }).toJSON();
    expect(json).toEqual({ hello: 1 });
  });
});
