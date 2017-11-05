'use strict';

exports = module.exports = function(config, program, rekwire, docker, ServiceManager, log) {

    const { async, await } = require('asyncawait');
    const prioritize = rekwire('prioritize');
    const devConfig = config.get('dev');
    const _ = require('lodash');
    const ora = require('ora');
    let spinner = ora().start();

    async(() => {

        function clone() {

            const Cloner = rekwire('cloner');

            const cloner = new Cloner({
                'replace': false
            });

            config.get('dev:repositories').forEach((repo) => {
                cloner.addRepo(repo);
            });

            cloner.on('clone', (repo) => {
                spinner.info(`Cloning repository: ${repo.url}`);
            });

            return cloner.clone();

        }

        await(clone());

        const prioritized = prioritize(config.get('composer:services'));

        prioritized.forEach((service) => {

            if (_.isUndefined(devConfig.services[service])) {
                return;
            }

            const manager = new ServiceManager(service);
            
            spinner.info(`Loading service: ${service}`);

            manager.on('stopping_containers', ({ count }) => {
                spinner.info(`Stopping ${count} existing container(s) for service: ${service}`);
            });
            
            manager.on('executing_command', (cmd) => {
                spinner.info(`Executing container command: ${cmd.join(' ')}`);
            });
            
            manager.on('executing_host_command', (cmd) => {
                spinner.info(`Executing host command: ${cmd.join(' ')}`);
            });
            
            manager.on('pulling_image', ({ image }) => {
                spinner.info(`Pulling image ${image} for service: ${service}`);
            });

            manager.on('building_image', ({ image }) => {
                spinner.info(`Building image ${image} for service: ${service}`);
            });

            manager.on('exporting_data', () => {
                spinner.info(`Exporting container files for service: ${service}`);
            });

            manager.on('starting_service', () => {
                spinner.info(`Starting service: ${service}`);
            });

            await(manager.up(program.force));

            spinner.succeed(`Service started: ${service}`);

        });

        spinner.stop();
        spinner.succeed(`${prioritized.length} service(s) are ready.`);

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager', 'log'];
