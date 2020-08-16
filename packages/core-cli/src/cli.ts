const { build } = require('gluegun');

export const run = async argv => {
  const cli = build()
    .brand('kraken')
    .src(__dirname)
    .help()
    .version()
    .create();
  return await cli.run(argv);
};
