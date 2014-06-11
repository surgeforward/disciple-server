module.exports = function (table) {

    var mongoAdapter = require('sails-mongo');
    
    mongoAdapter.config = {
        host: '127.0.0.1',
        port: 27017,
        database: 'disciple',
        user: '',
        pass: ''
    };

	return {
		tableName: table,
        adapters: {
        	mongodb: mongoAdapter
        }
    };
}