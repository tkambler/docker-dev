'use strict';

exports = module.exports = function(config, program, rekwire, docker, ServiceManager, log) {

    const { async, await } = require('asyncawait');
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
            
            cloner.on('checkout', (repo) => {
                spinner.info(`Checking out branch: ${repo.branch}`);
            });

            return cloner.clone();

        }

        await(clone());

        spinner.stop();

    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager', 'log'];
