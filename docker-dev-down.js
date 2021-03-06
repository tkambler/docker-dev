#!/usr/bin/env node
'use strict';

const program = require('commander');
const Container = require('ahoy-di');
const path = require('path');
const findProject = require('./lib/project-finder');
const loadYaml = require('./lib/yaml-loader');
const errorHandler = require('./lib/error-handler');
const debug = require('debug')('docker-dev');
const prioritize = require('./lib/prioritize');

process.on('uncaughtException', errorHandler);

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at:', p, 'reason:', reason);
    process.exit(1);
});

program
    .option('-p, --project [project-folder]', 'Project Folder')
    .option('-s, --service [name]', 'Service')
    .option('-f, --force', 'Remove the containers after stopping them')
    .parse(process.argv);

const projectFolder = findProject(program.project);
if (!projectFolder) {
    throw new Error(`Unable to locate project folder.`);
}

const yml = loadYaml(projectFolder);

const container = new Container({
    'services': [
        path.resolve(__dirname, 'services/shared')
    ]
});

const projectName = path.basename(projectFolder).replace(/\-/g, '');

container.constant('projectFolder', projectFolder);
container.constant('projectName', projectName);
container.constant('logFile', path.resolve(projectFolder, 'docker-dev.log'));
container.constant('program', program);
container.constant('yml', yml);

container.service('down', require('./services/commands/down'));

container.load('down');
