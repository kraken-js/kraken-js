module.exports = {
    name: 'init',
    alias: 'i',
    run: async function (toolbox) {
        const { filesystem, prompt, template, parameters } = toolbox

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

        const templateDir = 'templates'

        filesystem.find(`${templateDir}`, {
            matching: '*',
            recursive: true,
        }).forEach(async path => {
            path = path.replace(templateDir + '/', '');
            await template.generate({
                template: path,
                target: `${props.name}/${path.replace('.ejs', '')}`,
                props,
                directory: templateDir
            })
        })

    }
}
