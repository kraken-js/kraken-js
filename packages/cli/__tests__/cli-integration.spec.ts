const { system, filesystem } = require('gluegun');

const projectName = 'electric-wolf';
const src = filesystem.path(__dirname, '..');
const version = require('../package.json').version;

const cli = (cmd) => {
  return system.exec('node ' + filesystem.path(src, 'bin', 'kraken') + ` ${cmd}`);
};

describe('kraken.js', () => {
  test('outputs version', async () => {
    const output = await cli('--version');
    expect(output).toContain(version);
  });

  test('outputs help', async () => {
    const output = await cli('--help');
    expect(output).toContain(version);
  });

  describe('After Generate Project', () => {
    const timeout = 60000;

    beforeAll(async () => {
      process.chdir('..');
      await cli(`new --name ${projectName} --version 1.0.0 --skipInstall`).then(() => {
        process.chdir(projectName);
        filesystem.write('.env', 'ROOT_DOT_ENV=1');
        filesystem.write('.env.offline', 'OFFLINE_DOT_ENV=1');

        const packageJson = filesystem.read('package.json');
        const packageJsonWithLocal = packageJson.replace(/latest/g, version);
        filesystem.write('package.json', packageJsonWithLocal);

        return system.exec('yarn install --silent');
      });
    }, timeout);

    afterAll(() => {
      process.chdir('..');
      filesystem.remove(projectName);
    });

    test('kraken new should create project folder', async () => {
      filesystem.exists(projectName);
    }, timeout);

    test('serverless print --stage offline', async () => {
      const output = await system.exec('serverless print --stage offline', {
        env: {
          CI: 'true',
          SLS_WARNING_DISABLE: '*'
        }
      }).catch(console.error);
      expect(output).toMatchSnapshot();
    });

    test('should generate src/schema.ts file', async () => {
      await cli('graphql');
      expect(filesystem.read('src/schema.ts')).toMatchSnapshot();
    }, timeout);
  });
});
