'use strict';

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
	var awsEndpoint = new AWS.Endpoint(config.endpoint);

	function sendRequest (params, callback) {
		var req = new AWS.HttpRequest(awsEndpoint);
		req.method = params.method.toUpperCase();
		req.path = params.path;
		req.region = config.region;
		req.headers['presigned-expires'] = false;
		req.headers['Host'] = awsEndpoint.host;
		if (params.message) {
			req.body = typeof params.message == 'string' ? params.message : JSON.stringify(params.message);
		}

		var creds = new AWS.EnvironmentCredentials('AWS');

		var signer = new AWS.Signers.V4(req , 'es');
		signer.addAuthorization(creds, new Date());

		var send = new AWS.NodeHttpClient();
		send.handleRequest(req, null, function (httpResp) {
			handleSuccess(httpResp, params.json === false, callback);
		}, function (err) {
			handleFail(err, callback);
		});
	}

	function handleSuccess (httpResp, asPlainText, callback) {
		var respBody = '';
		httpResp.on('data', function (chunk) {
			respBody += chunk;
		});
		httpResp.on('end', function () {
			if (httpResp.statusCode >= 200 && httpResp.statusCode < 400) {
				if (asPlainText) {
					process.nextTick(function () {
						callback(null, respBody);
					});
				} else {
					try {
						var response = JSON.parse(respBody);
						process.nextTick(function () {
							callback(null, response);
						});
					} catch (ex) {
						var error = new Error('Invalid JSON response');
						error.responseText = respBody;
						process.nextTick(function () {
							callback(error);
						});
					}
				}
			} else {
				var errorMessage;
				try {
					var errorResponse = JSON.parse(respBody);
					errorMessage = errorResponse.message;
				} catch (ex) {
					errorMessage = respBody;
				}
				process.nextTick(function () {
					callback(new Error(errorMessage));
				});
			}
		});
	}

	function handleFail (err, callback) {
		var error = typeof err === 'string' ? new Error(err) : err;
		process.nextTick(function () {
			callback(error);
		});
	}

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
			if (!params) {
				process.nextTick(function () {
					callback(new TypeError('Missing or invalid parameters'));
				});
			} else if (!params.method) {
				process.nextTick(function () {
					callback(new TypeError('Missing method'));
				});
			} else {
				try {
					sendRequest(params, callback);
				} catch (ex) {
					process.nextTick(function () {
						callback(ex);
					});
				}
			}
		}
	};
};
