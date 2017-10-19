'use strict';

exports = module.exports = function(config, program, rekwire, docker, ServiceManager) {

    const { async, await } = require('asyncawait');
    const prioritize = rekwire('prioritize');
    const devConfig = config.get('dev');
    const chalk = require('chalk');
    const ora = require('ora');
    let spinner = ora('').start();

    async(() => {

        const services = prioritize(config.get('composer:services')).reverse();

        services.forEach((service) => {

            spinner.text = `Stopping service: ${service}`;

            const manager = new ServiceManager(service);

            await(manager.down());

            spinner.succeed(`Service stopped: ${service}`);

        });

        spinner.stop();

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager'];
