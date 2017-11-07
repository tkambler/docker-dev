'use strict';

exports = module.exports = function(config, program, rekwire, docker, ServiceManager, log) {

    const { async, await } = require('asyncawait');
    const prioritize = rekwire('prioritize');
    const devConfig = config.get('dev');
    const _ = require('lodash');
    const spawn = require('child_process').spawn;
    const ora = require('ora');
    // let spinner = ora().start();
    
    function exec(cmd) {
        return new Promise((resolve, reject) => {
            let spawned = spawn(cmd[0], cmd.slice(1), {
                'cwd': config.get('projectFolder')
            });
            let out = '';
            let err = '';
            spawned.stdout.on('data', (data) => {
                data = data.toString('utf8');
                out = out + data;
                log(data);
            });
            spawned.stderr.on('data', (data) => {
                data = data.toString('utf8');
                err = err + data;
                log(data);
            });
            spawned.on('close', (code) => {
                if (code === 0) {
                    return resolve();
                } else {
                    return reject({
                        'out': out,
                        'err': err,
                        'code': code
                    });
                }
            });
        });
    }
    
    async(() => {
        
        const cmds = program.args.map((arg) => {
            const cmd = config.get(`dev:commands:${arg}`);
            if (!cmd) {
                throw new Error(`Unknown command: ${arg}`);
            }
            return cmd;
        });
        
        _.each(cmds, (cmd) => {
            
            cmd.forEach((row) => {
                
                const { type, service, commands } = row;
                
                commands.forEach((cmd) => {
                    
                    switch (type) {
                        
                        case 'service':
                            
                            const sm = new ServiceManager(service);
                            return sm.executeCommand(null, cmd);
                        
                        case 'host':
                            return await(exec(cmd));
                        
                    }
                    
                });
                
            });
            
        });
        
    })();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'program', 'rekwire', 'docker', 'service-manager', 'log'];
