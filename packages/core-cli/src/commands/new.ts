const askOrGetParam = async (toolbox, question) => {
  const { prompt, parameters } = toolbox;
  if (parameters.options[question.name]) {
    return parameters.options[question.name];
  }
  return await prompt.ask(question)[question.name];
};

const makeQuestions = async toolbox => {
  const { parameters } = toolbox;
  const name = await askOrGetParam(toolbox, {
    type: 'input',
    name: 'name',
    message: 'What is the module name?',
    initial: parameters.first
  });
  const version = await askOrGetParam(toolbox, {
    type: 'input',
    name: 'version',
    message: 'What is the module version?',
    initial: '1.0.0'
  });
  return { name, version } as any;
};

module.exports = {
  name: 'new',
  alias: 'n',
  run: async function(toolbox) {
    const { filesystem, template, system } = toolbox;
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

    // yarn install
    await system.spawn(`cd ${props.name} && yarn install --silent`, {
      shell: true,
      stdio: 'inherit'
    });
  }
};
