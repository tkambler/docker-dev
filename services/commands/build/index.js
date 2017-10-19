'use strict';

exports = module.exports = function(config, program, rekwire, docker, ServiceManager) {

    const { async, await } = require('asyncawait');
    const prioritize = rekwire('prioritize');
    const devConfig = config.get('dev');
    const chalk = require('chalk');
    const ora = require('ora');
    const _ = require('lodash');
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

        let services = program.args;
        if (services.length === 0) {
            services = _.keys(config.get('dev:services'));
        }

        let skipCount = 0;
        let buildCount = 0;

        const prioritized = prioritize(config.get('composer:services'))
            .filter((ps) => {
                return services.indexOf(ps) >= 0;
            });

        prioritized.forEach((service) => {

            const manager = new ServiceManager(service);

            manager.on('building_image', ({ image }) => {
                spinner.text = `Building image ${image} for service: ${service}`;
                buildCount++;
            });

            manager.on('skip_build', () => {
                skipCount++;
            });

            manager.on('exporting_data', () => {
                spinner.text = `Exporting container files for service: ${service}`;
            });

            await(manager.build(program.force));
            await(manager.exportData(program.force));

//             spinner.succeed(`Image ${} for service: ${service}`);

        });

        spinner.stop();

        if (buildCount > 0) {
            spinner.succeed(`${buildCount} image(s) built.`);
        }

        if (skipCount > 0) {
            spinner.succeed(`Skipped building of ${skipCount} image(s) (pre-existing images found)`);
        }

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager'];
