const {build} = require('gluegun')

const cli = build('kraken')
    .src(__dirname)
    .help()
    .version()
    .create()

console.time('kraken.js')
cli.run().then(() => {
    console.timeEnd('kraken.js')
});
