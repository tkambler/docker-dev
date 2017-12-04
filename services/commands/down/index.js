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

        let stopped = 0;

        services.forEach((service) => {

            const manager = new ServiceManager(service);

            const isRunning = await(manager.isRunning());

            if (!isRunning) {
                return false;
            }

            spinner.info(`Stopping service: ${service}`);

            await(manager.down(program.force));

            spinner.succeed(`Service stopped: ${service}`);

            stopped++;

        });

        spinner.succeed(`${stopped} service(s) were stopped.`);

        spinner.stop();

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager'];
