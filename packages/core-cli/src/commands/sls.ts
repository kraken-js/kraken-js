// serverless wrapper
module.exports = {
  name: 'serverless',
  alias: 'sls',
  run: async function(toolbox) {
    const { system, parameters } = toolbox;
    system.run(`sls ${parameters.string}`);
  }
};
