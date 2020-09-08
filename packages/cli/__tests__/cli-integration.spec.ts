const { system, filesystem } = require('gluegun');

const src = filesystem.path(__dirname, '..');

const cli = (cmd) => {
  return system.run(
    'node ' + filesystem.path(src, 'bin', 'kraken') + ` ${cmd}`
  );
};

const projectName = '__kraken';

describe('kraken.js', () => {
  test('outputs version', async () => {
    const output = await cli('--version');
    expect(output).toContain('0.0.1');
  });

  test('outputs help', async () => {
    const output = await cli('--help');
    expect(output).toContain('0.0.1');
  });

  describe('After Generate Project', () => {
    const timeout = 30000;
    const state = { cwd: undefined };

    beforeAll(async () => {
      state.cwd = process.cwd();
      await cli(`new --name ${projectName} --version 1.0.0`).then(() => {
        process.chdir(projectName);
      });
    }, timeout);

    afterAll(() => {
      process.chdir(state.cwd);
      filesystem.remove(projectName);
    });

    test('kraken new should create project folder', async () => {
      filesystem.exists(projectName);
    }, timeout);

    test('should generate .kraken/serverless.json file', async () => {
      await cli('serverless print');
      expect(filesystem.read('.kraken/serverless.json')).toMatchSnapshot();
    }, timeout);

    test('should generate .kraken/graphql.ts file', async () => {
      await cli('graphql');
      expect(filesystem.read('.kraken/graphql.ts')).toMatchSnapshot();
    }, timeout);
  });
});
