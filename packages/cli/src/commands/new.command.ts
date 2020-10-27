import * as path from 'path';

const askOrGetParam = async ({ parameters, prompt }, question) => {
  if (parameters.options[question.name]) return parameters.options[question.name];
  return (await prompt.ask(question))[question.name];
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
  const { skipInstall } = parameters.options;
  return { name, version, skipInstall } as any;
};

module.exports = {
  name: 'new',
  alias: 'n',
  run: async toolbox => {
    const { filesystem, template, system, parameters } = toolbox;
    const props = await makeQuestions(toolbox);
    props.kraken = {
      version: 'latest'
    };

    const templatesPath = parameters.options.workspace
      ? `${__dirname}/../templates` // full yarn workspace with client && server
      : `${__dirname}/../templates/server/kraken`; // only server module
    const templates = filesystem.resolve(templatesPath);
    for (const templatePath of filesystem.find(templates, {
      matching: '*',
      recursive: true
    })) {
      const templateFile = path.relative(templatesPath, templatePath);
      await template.generate({
        template: templateFile,
        target: `${props.name}/${templateFile.replace('.ejs', '')}`,
        directory: templates,
        props
      });
    }

    // yarn install
    if (!props.skipInstall) {
      await system.spawn(`cd ${props.name} && yarn install --silent`, {
        shell: true,
        stdio: 'inherit'
      });
    }
    // kraken graphql
    await system.spawn(`cd ${props.name} && kraken graphql`, {
      shell: true,
      stdio: 'inherit'
    });
  }
};
