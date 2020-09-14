const mainPackageJson = require('../package.json');
const glob = require('glob');
const fs = require('fs');

const version = mainPackageJson.version;
console.log('Bumping all packages to version:', version);

const upgradeVersions = (dependencies = {}) => {
  Object.keys(dependencies).forEach(dep => {
    if (dep.startsWith('@kraken.js/'))
      dependencies[dep] = version;
  });
};

glob.sync('./packages/*/package.json')
  .forEach(location => {
    const packageJsonStr = fs.readFileSync(location).toString();
    const packageJson = JSON.parse(packageJsonStr);
    packageJson.version = version;
    upgradeVersions(packageJson.dependencies);
    upgradeVersions(packageJson.devDependencies);
    fs.writeFileSync(location, JSON.stringify(packageJson, null, 2));
  });
