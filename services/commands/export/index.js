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
        let exportCount = 0;

        const prioritized = prioritize(config.get('composer:services'))
            .filter((ps) => {
                return services.indexOf(ps) >= 0;
            });

        prioritized.forEach((service) => {

            const manager = new ServiceManager(service);

            manager.on('exporting_data', () => {
                exportCount++;
            });

            manager.on('skip_export', () => {
                skipCount++;
            });

            manager.on('exporting_data', () => {
                spinner.text = `Exporting container files for service: ${service}`;
            });

            await(manager.exportData(program.force));

        });

        spinner.stop();

        if (exportCount > 0) {
            spinner.succeed(`Data exported from ${exportCount} image(s).`);
        }

        if (skipCount > 0) {
            spinner.succeed(`Skipped the exportation of data from ${skipCount} image(s) (data already exported)`);
        }

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager'];
