'use strict';

exports = module.exports = function(config, program, rekwire, docker, ServiceManager) {

    const { async, await } = require('asyncawait');
    const prioritize = rekwire('prioritize');
    const chalk = require('chalk');
    const ora = require('ora');
    let spinner = ora('').start();

    async(() => {

        const prioritized = prioritize(config.get('composer:services'));

        prioritized.forEach((service) => {

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

            return await(manager.up({
                'force': program.force
            }));

        });

        spinner.stop();
        console.log(chalk.green(`${prioritized.length} service(s) are ready.`));

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager'];
