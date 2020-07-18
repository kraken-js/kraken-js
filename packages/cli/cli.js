const { build } = require('gluegun')

const cli = build('kraken')
    .src(__dirname)
    .help()
    .version()
    .create()

cli.run()
