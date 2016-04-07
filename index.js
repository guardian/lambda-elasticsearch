'use strict';

var signer = require('aws-signed-request');
/**
 * Create the utility that sends elasticsearch request
 *
 * @param {aws-sdk} AWS sdk
 * @param {Object} config Configuration containing
 *    * endpoint: Elasticsearch endpoint
 *    * region: AWS region
 * @return {Object} Utility with method `send`
 */
module.exports = function (AWS, config) {
	var elastic = signer(AWS, {
		endpoint: config.endpoint,
		region: config.region,
		service: 'es'
	});

	return {
		/**
		 * Send a request to ElastiSearch
		 * @param {Object} params Object containing
		 *    * method: HTTP method (e.g GET, POST)
		 *    * path: Request path (e.g. '/_cat/indices')
		 *    * message: Request body (String or JSON)
		 *    * json: Boolean, whether the response from the server should be parsed as JSON
		 * @return {[type]} [description]
		 */
		send: function (params, callback) {
			elastic.send(params, callback);
		}
	};
};
