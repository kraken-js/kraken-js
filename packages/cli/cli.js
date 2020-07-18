const {build, print} = require('gluegun')

const cli = build('kraken')
    .src(__dirname)
    .help()
    .version()
    .create()

cli.run().then(() => {
    print.success('🐙')
});
