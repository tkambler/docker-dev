'use strict';

const _ = require('lodash');
const DepGraph = require('dependency-graph').DepGraph;

module.exports = (services) => {

    services = _.cloneDeep(services);

    const graph = new DepGraph();

    _.each(services, (service, name) => {
        graph.addNode(name);
    });

    _.each(services, (service, name) => {
        _.defaults(service, {
            'depends_on': [],
            'links': []
        });
        service.depends_on.forEach((dep) => {
            graph.addDependency(name, dep);
        });
        service.links.forEach((dep) => {
            graph.addDependency(name, dep);
        });
    });

    return graph.overallOrder();

};
