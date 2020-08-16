const { system, filesystem } = require('gluegun');

const src = filesystem.path(__dirname, '..');

const cli = cmd => {
  return system.run('node ' + filesystem.path(src, 'bin', 'kraken') + ` ${cmd}`);
};

const projectName = '__kraken';

describe('kraken.js', () => {
  afterEach(() => {
    filesystem.remove(projectName);
  });

  test('outputs version', async () => {
    const output = await cli('--version');
    expect(output).toContain('0.0.1');
  });

  test('outputs help', async () => {
    const output = await cli('--help');
    expect(output).toContain('0.0.1');
  });

  test('generates file', async () => {
    await cli(`new --name ${projectName} --version 1.0.0`);
    filesystem.exists(projectName);
  });
});
