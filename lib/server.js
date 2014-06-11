var util = require('util');
var extend = require('util-extend');
var _ = require('lodash');
var jsonic = require('jsonic');

var http = require('http');
var app = require('express')();

var mlearn = require('mlearn.js');

var Waterline = require('waterline');
var Disciple = Waterline.Collection.extend(require('./collections/disciple.js'));
var Dataset = Waterline.Collection.extend(require('./collections/dataset.js'));
var DiscipleModel = Waterline.Collection.extend(require('./collections/model.js'));

/**
 * Admin console for interacting with running disciple-server instances
 *
 * @author      Surge Forward       <ncurtis@surgeforward.com>
 */
module.exports = function () {
    
    var server = {};

    /**
     * Initial startup point for disciple server
     */
    server.init = function (port) {

        // set all disciples in database to disconnected
        new Disciple(require('./config.js')('disciple'), function (e, ORM) {
            ORM.find().exec(function (e, Collection) {
                _.each(Collection, function (Model) {
                    Model.status = 'disconnected';
                    Model.save(function () {
                        return true;
                    });
                });
            });
        });

        // setup socket connections for disciple-client
        var clientServer = http.Server(app);
        var clientio = require('socket.io')(clientServer);

        clientio.sockets.on('connection', function (client) {

            util.log('disciple-connection');

            client.on('disciple-connected', function (data) {
                util.log('disciple-connected', data);
                server.disciple.status(client.id, 'connected', data);
            });
            
            client.on('disconnect', function () {
                util.log('disconnect', data);
                server.disciple.disconnect(client.id);
            });

        });

        clientServer.listen(parseInt(port), function () {
            console.log('Listening on port ' + port + ' for disciple client connections.');
        });
    };

    /**
     * Initial startup point for disciple admin server
     */
    server.admin = function (port) {
        var adminServer = http.Server(app);
        var adminio = require('socket.io')(adminServer);

        adminio.on('connection', function (admin) {
            
            util.log('admin-connection');

            admin.on('disciples:flush', function (data) {
                try {
                    util.log('disciples', data);
                    var search = jsonic(data);
                    server.disciple.flush(admin, search);
                } catch (e) {
                    admin.emit('response:json', e);
                }
            });

            admin.on('disciples', function (data) {
                try {
                    util.log('disciples', data);
                    var search = jsonic(data);
                    server.disciple.list(admin, search);
                } catch (e) {
                    admin.emit('response:json', e);
                }
            });
            
            admin.on('models', function (data) {
                try {
                    util.log('models', data);
                    var search = jsonic(data);
                    server.model.list(admin, search);
                } catch (e) {
                    admin.emit('response:json', e);
                }
            });
            
            admin.on('model', function (data) {
                try {
                    util.log('model', data);
                    var search = jsonic(data);
                    server.model.update(admin, search);
                } catch (e) {
                    admin.emit('response:json', e);
                }
            });

            admin.on('model:drop', function (data) {
                try {
                    util.log('model:drop', data);
                    var search = jsonic(data);
                    server.model.drop(admin, search);
                } catch (e) {
                    admin.emit('response:json', e);
                }
            });

        });

        adminServer.listen(parseInt(port), function () {
            console.log('Listening on port ' + port + ' for admin console connections.');
        });
    }

    /**
     * Container for all disciple api methods
     */
    server.disciple = {
        /**
         * searches db for disciples matching search and removes them
         *
         * @param   admin       admin socket handler
         * @param   object      object literal mongo query
         * @return  void
         */
        flush: function (admin, search) {
            new Disciple(require('./config.js')('disciple'), function (e, ORM) {
                if (_.keys(search).length <= 0) {
                    search = {status: 'disconnected'};
                }

                var dropped = 0;
                ORM.find(search).exec(function (e, Collection) {
                    if (Collection) {
                        _.each(Collection, function (Model) {
                            Model.destroy(function (e) {
                                if (e) util.log(e); else dropped++;
                            });
                        });
                    }
                    admin.emit('response:text', 'Dropped ' + dropped + ' Disciples!');
                });
            });
        },
        /**
         * searches db for disciples matching search and sends back to admin client
         *
         * @param   admin       admin socket handler
         * @param   object      object literal mongo query
         * @return  void
         */
        list: function (admin, search) {
            new Disciple(require('./config.js')('disciple'), function (e, ORM) {
                if (_.keys(search).length <= 0) {
                    search = {status: {not: 'disconnected'}};
                }

                ORM.find(search).exec(function (e, Collection) {
                    var disciples = _.map(Collection, function (Model) {
                        return Model.toObject();
                    });
                    admin.emit('response:json', JSON.stringify(disciples));
                });
            });
        },
        /**
         * Updates disciple status, creates new disciple if none is found with matching id 
         *
         * @param   id          client session id or disciple id
         * @param   string      new status of disciple
         * @param   object      object literal with disciple data
         * @return  void
         */
        status: function (clientId, status, data) {
            new Disciple(require('./config.js')('disciple'), function (e, ORM) {
                ORM.find({discipleId: data.id}).exec(function (e, Collection) {
                    if ( ! Collection || Collection.length <= 0 ) {
                        server.disciple.create(clientId, data);
                    } else {
                        var Model = _.first(Collection);
                        Model.status = status;
                        Model.save(function (e) {
                            if (e) util.log(e);
                        });
                    }
                });
            });
        },
        /**
         * inserts new disciple into database
         *
         * @param   id          client session id or disciple id
         * @param   object      object literal with disciple data
         * @return  void
         */
        create: function (clientId, data) {
            new Disciple(require('./config.js')('disciple'), function (e, ORM) {
                var disciple = {
                    clientId: clientId,
                    discipleId: data.id,
                    hostname: data.hostname,
                    status: 'connected',
                    ram: data.ram,
                    cpus: data.cpus,
                    os: data.os
                };

                ORM.create(disciple, function (e, Model) {
                    if (e) util.log(e);
                });
            });
        },
        /**
         * finds disciple client in database and updates status to disconnected
         *
         * @param   id          client session id or disciple id
         * @return  void
         */
        disconnect: function (clientId) {
            new Disciple(require('./config.js')('disciple'), function (e, ORM) {
                ORM.find({clientId: clientId}).exec(function (e, Collection) {
                    if (Collection.length > 0) {
                        var Model = _.first(Collection);
                        Model.status = 'disconnected';
                        Model.save(function (e) {
                            if (e) util.log(e);
                        });
                    }
                });
            });
        }
    };

    /**
     * Container for all disciple model api methods
     */
    server.model = {
        /**
         * searches mongo for models matching "search"
         *
         * @param   admin       admin socket handler
         * @param   object      object literal mongo query
         * @return  void
         */
        list: function (admin, search) {
            new DiscipleModel(require('./config.js')('model'), function (e, ORM) {
                ORM.find(search).exec(function (e, Collection) {
                    var discipleModels = _.map(Collection, function (Model) {
                        return Model.toObject();
                    });
                    admin.emit('response:json', JSON.stringify(discipleModels));
                });
            });
        },
        /**
         * creates new disciple model in database
         *
         * @param   admin       admin socket handler
         * @param   object      object literal mongo model data
         * @return  void
         */
        create: function (admin, data) {
            new DiscipleModel(require('./config.js')('model'), function (e, ORM) {
                
                var modelType = (data.type == 'classifier') ? 'classifier' : 'regressor' ;

                var discipleModel = {
                    name: data.name,
                    description: data.description,
                    type: modelType,
                    dataset: data.dataset
                };

                ORM.create(discipleModel, function (e, Model) {
                    if (e) {
                        admin.emit('response:json', JSON.stringify(e));
                    } else {
                        admin.emit('response:json', {status: 'success'});
                    }
                });
            });
        },
        /**
         * searches for model and updates it, creates new model if no matching one exists
         *
         * @param   admin       admin socket handler
         * @param   object      object literal mongo object to update, match is based off object.id
         * @return  void
         */
        update: function (admin, search) {
            new DiscipleModel(require('./config.js')('model'), function (e, ORM) {
                ORM.find({id: search.id}).exec(function (e, Collection) {
                    if ( ! Collection || Collection.length <= 0) {
                        server.model.create(admin, search);
                    } else {
                        var Model = _.first(Collection);

                        extend(Model, {
                            name: search.name,
                            description: search.description,
                            type: search.type,
                            dataset: search.dataset
                        });
                        
                        Model.save(function (e, Model) {
                            if (e) {
                                admin.emit('response:json', JSON.stringify(e));
                            } else {
                                admin.emit('response:json', {status: 'success'});
                            }
                        });
                    }
                });
            });
        },
        /**
         * deletes models matching search from database
         *
         * @param   admin       admin socket handler
         * @param   object      object literal mongo query
         * @return  void
         */
        drop: function (admin, data) {
            new DiscipleModel(require('./config.js')('model'), function (e, ORM) {
                var dropped = 0;
                ORM.find(data).exec(function (e, Collection) {
                    if (Collection) {
                        _.each(Collection, function (Model) {
                            Model.destroy(function () { dropped++; });
                        });
                    }
                    admin.emit('response:text', 'Dropped ' + dropped  + ' Models!');
                });
            });
        }
    };

     /**
     * Container for all disciple dataset api methods
     */
    server.dataset = {

    };

    return server;
}