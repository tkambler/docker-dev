'use strict';

exports = module.exports = function(config, program, rekwire, docker, ServiceManager, hostfileManager, log) {

    const { async, await } = require('asyncawait');
    const prioritize = rekwire('prioritize');
    const devConfig = config.get('dev');
    const _ = require('lodash');
    const ora = require('ora');
    const open = require('open');
    let spinner = ora().start();

    async(() => {

        let prioritized = Object.keys(config.get('dev:services'));

        prioritized.forEach((service) => {

            const manager = new ServiceManager(service);
            const isRunning = await(manager.isRunning());

            if (isRunning) {
                spinner.succeed(`Service is running: ${service}`);
            } else {
                spinner.fail(`Service is not running: ${service}`);
            }

        });

        const services = prioritize(config.get('composer:services')).reverse();

        services.forEach((service) => {

            if (prioritized.indexOf(service) === -1) {
                spinner.info(`The following service, which is defined in docker-compose.yml, lacks a corresponding service definition in docker-dev.yml: ${service}`);
            }

        });

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager', 'hostfile-manager', 'log'];
