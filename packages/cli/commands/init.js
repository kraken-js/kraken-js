const serverModules = [
    ''
]

module.exports = {
    name: 'init',
    alias: 'i',
    run: async function (toolbox) {
        
        const { system, print, filesystem, strings, parameters, template } = toolbox

        const name = parameters.first

        await template.generate({
            template: 'package.ejf',
            target: `${name}/package.json`,
            props: { name },
        })

    }
}