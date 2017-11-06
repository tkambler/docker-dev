#!/usr/bin/env node
'use strict';

const program = require('commander');
const figlet = require('figlet');
const chalk = require('chalk');
const pkg = require('./package.json');

program
    .version(pkg.version)
    .command('up', 'Create and start containers.')
    .command('down', 'Stop running containers.')
    .command('build', 'Builds one or more services.')
    .command('clone', 'Clone repositories.')
    .command('export', 'Exports files from one or more images.');

if (!process.argv.slice(2).length || process.argv[2] === '--help' || process.argv[2] === '-h') {
    const banner = figlet.textSync('Docker-Dev', {
        'font': 'Rectangles',
        'horizontalLayout': 'default',
        'verticalLayout': 'default'
    });
    console.log(chalk.cyan(banner));
    program.help((text) => {
        return `  Version: ${pkg.version}
${text}
`;
    });
}

program.parse(process.argv);
