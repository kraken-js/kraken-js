const { system, filesystem } = require('gluegun');

const projectName = 'electric-wolf';
const src = filesystem.path(__dirname, '..');

const cli = (cmd) => {
  return system.exec('node ' + filesystem.path(src, 'bin', 'kraken') + ` ${cmd}`);
};

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

    test('serverless print --stage offline', async () => {
      const output = await system.exec('serverless print --stage offline', { env: { CI: 'true' } });
      expect(output).toMatchSnapshot();
    });

    test('kraken new should create project folder', async () => {
      filesystem.exists(projectName);
    }, timeout);

    test('should generate src/schema.ts file', async () => {
      await cli('graphql');
      expect(filesystem.read('src/schema.ts')).toMatchSnapshot();
    }, timeout);
  });
});
