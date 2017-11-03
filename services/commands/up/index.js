'use strict';

exports = module.exports = function(config, program, rekwire, docker, ServiceManager, log) {

    const { async, await } = require('asyncawait');
    const prioritize = rekwire('prioritize');
    const devConfig = config.get('dev');
    const chalk = require('chalk');
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
                spinner.text = `Cloning repository: ${repo.url}`;
            });

            return cloner.clone();

        }

        await(clone());

        const prioritized = prioritize(config.get('composer:services'));

        prioritized.forEach((service) => {

            if (!devConfig.services[service]) {
                return;
            }

            const manager = new ServiceManager(service);

            manager.on('stopping_containers', ({ count }) => {
                spinner.text = `Stopping ${count} existing container(s) for service: ${service}`
            });

            manager.on('building_image', ({ image }) => {
                spinner.text = `Building image ${image} for service: ${service}`;
            });

            manager.on('exporting_data', () => {
                spinner.text = `Exporting container files for service: ${service}`;
            });

            manager.on('starting_service', () => {
                spinner.text = `Starting service: ${service}`;
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
