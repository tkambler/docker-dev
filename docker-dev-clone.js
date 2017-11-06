#!/usr/bin/env node
'use strict';

const program = require('commander');
const Container = require('ahoy-di');
const path = require('path');
const findProject = require('./lib/project-finder');
const loadYaml = require('./lib/yaml-loader');
const errorHandler = require('./lib/error-handler');

process.on('uncaughtException', errorHandler);

process.on('unhandledRejection', (err, p) => {

    console.log('');

    if (err.out) {
        console.log(err.out);
    }

    if (err.err) {
        console.log(err.err);
    }

    if (err.message) {
        console.log(err.message);
    }

    process.exit(1);

});

program
    .option('-p, --project [project-folder]', 'Project Folder')
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
container.constant('program', program);
container.constant('logFile', path.resolve(projectFolder, 'docker-dev.log'));
container.constant('yml', yml);

container.service('clone', require('./services/commands/clone'));

container.load('clone');
