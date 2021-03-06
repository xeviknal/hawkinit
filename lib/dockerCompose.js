'use strict';

const execSync = require('child_process').execSync;
const exec = require('child_process').exec;
const chalk = require('chalk');
const parseKeyValue = require('parse-key-value');

const runCommand = (command, path, asynchronous, customOptions) => {
  const options = {
    cwd: path,
    killSignal: 'SIGTERM',
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['inherit', 'inherit', 'inherit']
  };
  if (customOptions) {
    Object.assign(options, customOptions);
  }
  console.log(chalk.cyan(`Running '${command}' in directory: ${path}`));
  const executable = asynchronous ? exec : execSync;
  const dc = executable(command, options);
  dc && dc.stdout && dc.stdout.on('data', (data) => {
    data && console.log(`${data}`);
  });
  dc && dc.stderr && dc.stderr.on('data', (data) => {
    data && console.log(`stderr: ${data}`);
  });
  return dc;
};

const dockerComposePull = (path, asynchronous) =>
  runCommand('docker-compose pull', path, asynchronous);

const dockerComposeUp = (path, asynchronous) =>
  runCommand('docker-compose up --force-recreate', path, asynchronous);

const dockerComposeRm = (path, timeout) => {
  if (timeout > 0) {
    runCommand(`sleep ${timeout} && docker-compose rm --force --all`, path, true);
  } else {
    runCommand('docker-compose rm --force --all', path, false);
  }
};

const dockerComposeKill = (path, timeout) => {
  if (timeout > 0) {
    runCommand(`sleep ${timeout} && docker-compose kill`, path, true);
    dockerComposeRm(path, timeout + 2);
  } else {
    runCommand('docker-compose rm --force --all', path, false);
  }
};

const dockerComposePs = (path, service) => {
  const output = runCommand(
    `docker-compose ps -q ${service}`,
    path,
    false,
    { stdio: ['inherit', 'pipe', 'inherit'] }
  );
  return output.toString().trim().split(/\r?\n/);
};

const openshiftKill = (timeout) => {
  if (timeout > 0) {
    runCommand(`sleep ${timeout} && oc cluster down`, null, true);
  } else {
    runCommand('oc cluster down', null, false);
  }
};

const dockerRunCassandraNode = (version, id) => {
  const container = `docker ps | grep cassandra:${version} | cut -f1 -d' '`;
  const ip = `docker inspect --format='{{ .NetworkSettings.IPAddress }}' \`${container}\``;
  const cmd = `docker run --name cassandra-node-${id} -d -e CASSANDRA_SEEDS="$(${ip})" cassandra:${version}`;
  return runCommand(`sleep 4 && echo "running C*.." && ${cmd}`, '.', true);
};

const dockerKillAllCassandraNodes = (version) => {
  const containers = `docker ps -a | grep 'cassandra:${version}.*cassandra-node-' | cut -f1 -d' '`;
  const cmd = `docker rm -f \`${containers}\``;
  return runCommand(cmd, '.', true);
};

const dockerEnvironmentVariables = (container) => {
  const command = `docker inspect \
  --format='{{range $index, $value := .Config.Env}}{{if $index}};{{$value}}{{end}}{{end}}' ${container}`;
  const output = runCommand(command, '/', false, { stdio: ['inherit', 'pipe', 'inherit'] });
  return parseKeyValue(output);
};

const dockerCreate = (path, image) => {
  const output = runCommand(
    `docker create ${image}`,
    path,
    false,
    { stdio: ['inherit', 'pipe', 'inherit'] }
  );
  return output.toString().trim();
};

const dockerRm = container =>
  runCommand(`docker rm -f ${container}`, '.');

const dockerCopy = (source, destination) =>
  runCommand(`docker cp ${source} ${destination}`, '.');

const dockerBuild = (path, image) =>
  runCommand(`docker build --pull=true -t ${image} .`, path);

const dockerComposeScale = (path, service, instances) =>
  runCommand(`sleep 7 && docker-compose scale ${service}=${instances}`, path, true);

module.exports = {
  pull: dockerComposePull,
  up: dockerComposeUp,
  create: dockerCreate,
  rm: dockerComposeRm,
  ps: dockerComposePs,
  cp: dockerCopy,
  removeContainer: dockerRm,
  build: dockerBuild,
  env: dockerEnvironmentVariables,
  kill: dockerComposeKill,
  scale: dockerComposeScale,
  runCassandra: dockerRunCassandraNode,
  cassandraCleanup: dockerKillAllCassandraNodes,
  ocKill: openshiftKill
};
