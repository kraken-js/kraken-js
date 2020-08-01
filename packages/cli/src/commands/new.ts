const makeQuestions = async toolbox => {
  const { prompt, parameters } = toolbox;
  const askModuleName = {
    type: 'input',
    name: 'name',
    message: 'What is the module name?',
    initial: parameters.first
  };
  const askModuleVersion = {
    type: 'input',
    name: 'version',
    message: 'What is the module version?',
    initial: '1.0.0'
  };
  const questions = [askModuleName, askModuleVersion];
  return await prompt.ask(questions);
};

module.exports = {
  name: 'new',
  alias: 'n',
  run: async function(toolbox) {
    const { filesystem, template } = toolbox;
    const props = await makeQuestions(toolbox);
    props.kraken = {
      version: 'latest'
    };

    const templateDir = filesystem.resolve(`${__dirname}/../templates`);

    for (const path of filesystem.find(`${templateDir}`, {
      matching: '*',
      recursive: true
    })) {
      const tmpl = path.split('src/templates/')[1];
      await template.generate({
        template: tmpl,
        target: `${props.name}/${tmpl.replace('.ejs', '')}`,
        props,
        directory: templateDir
      });
    }
  }
};
