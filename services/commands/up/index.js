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

            cloner.on('checkout', (repo) => {
                spinner.info(`Checking out branch: ${repo.branch}`);
            });

            return cloner.clone();

        }

        await(clone());

        hostfileManager.set(devConfig.hostnames);

        let prioritized = Object.keys(config.get('dev:services'));

        if (program.service) {
            if (prioritized.indexOf(program.service) === -1) {
                throw new Error(`Unknown service: ${program.service}`);
            } else {
                prioritized = [program.service];
            }
        }

        let started = 0;

        prioritized.forEach((service) => {

            const manager = new ServiceManager(service);

            manager.on('already_running', () => {
                spinner.info(`Service is already running: ${service}`);
            });

            manager.on('wait_healthcheck', () => {
                spinner.info(`Waiting for healthcheck to pass.`);
            });

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
                spinner.info(`Building image for service: ${service}`);
            });

            manager.on('exporting_data', () => {
                spinner.info(`Exporting container files for service: ${service}`);
            });

            manager.on('starting_service', () => {
                spinner.info(`Starting service: ${service}`);
            });

            manager.on('service_started', () => {
                spinner.succeed(`Service started: ${service}`);
                started++;
            });

            await(manager.up(program.force));

        });

        spinner.stop();
        spinner.succeed(`${started} service(s) were started.`);

//         if (devConfig.open.length > 0 && !program.service) {
//             devConfig.open.forEach((url) => {
//                 open(url);
//             });
//         }

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager', 'hostfile-manager', 'log'];
