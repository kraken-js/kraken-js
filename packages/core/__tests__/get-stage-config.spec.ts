import { getStageConfig } from '..';

describe('Get Stage Config', () => {
  it.each([
    [{ x: 1 }, { x: 1 }],
    [{ test: { y: 1 }, other: { z: 1 } }, { y: 1 }],
    [{ default: { x: 1 }, test: { y: 1 } }, { x: 1, y: 1 }]
  ])('should get stage config for %o', (config, expected) => {
    const actual = getStageConfig(config as any);
    expect(actual).toEqual(expected);
  });
});
