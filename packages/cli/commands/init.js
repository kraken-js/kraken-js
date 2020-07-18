const serverModules = [
    ''
]

module.exports = {
    name: 'init',
    alias: 'i',
    run: async function (toolbox) {
        const {prompt, template, parameters} = toolbox

        const askModuleName = {
            type: 'input',
            name: 'name',
            message: 'What is the module name?',
            initial: parameters.first
        }
        const askModuleVersion = {
            type: 'input',
            name: 'version',
            message: 'What is the module version?',
            initial: '1.0.0'
        }
        const questions = [askModuleName, askModuleVersion]
        const props = await prompt.ask(questions)

        await template.generate({
            template: 'package.ejf',
            target: `${props.name}/package.json`,
            props
        })
    }
}
