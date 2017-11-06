'use strict';

const EventEmitter2 = require('eventemitter2').EventEmitter2;
const simpleGit = require('simple-git/promise');
const { async, await } = require('asyncawait');
const Promise = require('bluebird');
const _ = require('lodash');
const fs = require('./fs');

class Cloner extends EventEmitter2 {

    constructor({ replace }) {

        super();
        this.cloneConcurrency = 3;
        this.replace = _.isBoolean(replace) ? replace : false;

    }

    get repos() {
        return this._repos ? this._repos : this._repos = [];
    }

    addRepo(repo) {
        return this.repos.push(_.cloneDeep(repo));
    }

    onComplete(repo) {
        repo.cloned = true;
        const cloned = _.filter(this.repos, { 'cloned': true }).length;
        this.emit('progress', Math.floor(cloned / this.repos.length * 100));
    }

    clone() {

        this.emit('progress', 0);

        return Promise.map(this.repos, (repo) => {

            const clone = () => {
                this.emit('clone', repo);
                return simpleGit()
                    .silent(true)
                    .clone(repo.url, repo.dest);
            };

            const checkout = () => {
                if (!repo.branch) {
                    return;
                }
                // this.emit('checkout', repo);
                return simpleGit(repo.dest)
                    .checkout(repo.branch);
            };

            return fs.statAsync(repo.dest)
                .catch(() => {
                    return null;
                })
                .then((stats) => {

                    if (!stats) {
                        return clone()
                            .then(checkout)
                            .then(() => {
                                return this.onComplete(repo);
                            });
                    } else if (this.replace) {
                        return fs.removeAsync(repo.dest)
                            .then(checkout)
                            .then(clone)
                            .then(() => {
                                return this.onComplete(repo);
                            });
                    } else {
                        this.onComplete(repo);
                        return;
                    }

                });

        }, {
            'concurrency': this.cloneConcurrency
        })


    }

}

module.exports = Cloner;
