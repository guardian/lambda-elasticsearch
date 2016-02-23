'use strict';

var tap = require('tap');
var elastic = require('./index');
var EventEmitter = require('events').EventEmitter;

var testConfig = {
	region: 'eu-west-1',
	endpoint: 'elastic.search.es.amazonaws.com'
};

var AWS = function (implementations) {
	var Endpoint = [],
		HttpRequest = [],
		EnvironmentCredentials = [],
		SignersV4 = [],
		SignersAddAuthorization = [],
		NodeHttpClient = [],
		handleRequest = [];

	return {
		Endpoint: function () {
			Endpoint.push([].slice.apply(arguments));
			return {
				host: 'aws-host'
			};
		},
		HttpRequest: function () {
			HttpRequest.push([].slice.apply(arguments));
			return {
				headers: {}
			};
		},
		EnvironmentCredentials: function () {
			EnvironmentCredentials.push([].slice.apply(arguments));
		},
		Signers: {
			V4: function () {
				SignersV4.push([].slice.apply(arguments));
				return {
					addAuthorization: function () {
						SignersAddAuthorization.push([].slice.apply(arguments));
					}
				};
			}
		},
		NodeHttpClient: function () {
			NodeHttpClient.push([].slice.apply(arguments));
			return {
				handleRequest: function () {
					handleRequest.push([].slice.apply(arguments));
					implementations.handleRequest.apply(null, arguments);
				}
			};
		},
		spies: {
			Endpoint: Endpoint,
			HttpRequest: HttpRequest,
			EnvironmentCredentials: EnvironmentCredentials,
			SignersV4: SignersV4,
			SignersAddAuthorization: SignersAddAuthorization,
			NodeHttpClient: NodeHttpClient,
			handleRequest: handleRequest
		}
	};
};

tap.test('fails on invalid params', function (test) {
	var aws = AWS({});
	var es = elastic(aws, testConfig);
	es.send(null, function (err) {
		test.type(err, TypeError);
		test.match(err.message, /missing/i);
		test.end();
	});
});

tap.test('fails on missing method', function (test) {
	var aws = AWS({});
	var es = elastic(aws, testConfig);
	es.send({}, function (err) {
		test.type(err, TypeError);
		test.match(err.message, /missing method/i);
		test.end();
	});
});

tap.test('fails on exceptions', function (test) {
	var aws = AWS({
		handleRequest: function () {
			throw new Error('No you can\'t');
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'GET'
	}, function (err) {
		test.type(err, Error);
		test.match(err.message, /no you/i);
		test.end();
	});
});

tap.test('fails on HTTP client error as string', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData, onError) {
			onError('invalid string');
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'GET'
	}, function (err) {
		test.type(err, Error);
		test.match(err.message, /invalid string/i);
		test.end();
	});
});

tap.test('fails on HTTP client error as error', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData, onError) {
			onError(new Error('invalid error'));
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'GET'
	}, function (err) {
		test.type(err, Error);
		test.match(err.message, /invalid error/i);
		test.end();
	});
});

tap.test('fails on AWS status error with plain text', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData) {
			var emitter = new EventEmitter();
			emitter.statusCode = 400;
			onData(emitter);

			process.nextTick(function () {
				emitter.emit('data', 'plain text');
				emitter.emit('end');
			});
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'GET'
	}, function (err) {
		test.type(err, Error);
		test.match(err.message, /plain text/i);
		test.end();
	});
});

tap.test('fails on AWS status error with JSON', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData) {
			var emitter = new EventEmitter();
			emitter.statusCode = 400;
			onData(emitter);

			process.nextTick(function () {
				emitter.emit('data', JSON.stringify({
					message: 'json error'
				}));
				emitter.emit('end');
			});
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'GET'
	}, function (err) {
		test.type(err, Error);
		test.match(err.message, /json error/i);
		test.end();
	});
});

tap.test('works correctly with plain text', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData) {
			var emitter = new EventEmitter();
			emitter.statusCode = 200;
			onData(emitter);

			process.nextTick(function () {
				emitter.emit('data', 'response');
				emitter.emit('data', ' as ');
				emitter.emit('data', 'text');
				emitter.emit('end');
			});
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'GET',
		json: false
	}, function (err, data) {
		test.equal(data, 'response as text');
		test.end();
	});
});

tap.test('fails when JSON cannot be serialized', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData) {
			var emitter = new EventEmitter();
			emitter.statusCode = 200;
			onData(emitter);

			process.nextTick(function () {
				emitter.emit('data', 'response text expecting json');
				emitter.emit('end');
			});
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'GET'
	}, function (err) {
		test.type(err, Error);
		test.match(err.message, /invalid json/i);
		test.equal(err.responseText, 'response text expecting json');
		test.end();
	});
});

tap.test('works correctly with JSON', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData) {
			var emitter = new EventEmitter();
			emitter.statusCode = 200;
			onData(emitter);

			process.nextTick(function () {
				var message = JSON.stringify({
					results: ['one', 'two']
				});
				emitter.emit('data', message.slice(0, 20));
				process.nextTick(function () {
					emitter.emit('data', message.slice(20));
					process.nextTick(function () {
						emitter.emit('end');
					});
				});
			});
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'GET'
	}, function (err, data) {
		test.same(data, {
			results: ['one', 'two']
		});
		test.end();
	});
});

tap.test('assert request parameters with string message', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData) {
			var emitter = new EventEmitter();
			emitter.statusCode = 400;
			onData(emitter);

			process.nextTick(function () {
				emitter.emit('end');
			});
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'post',
		path: 'test'
	}, function () {
		test.same(aws.spies.Endpoint, [['elastic.search.es.amazonaws.com']]);
		test.ok(aws.spies.SignersV4[0][0], 'request should be signed');
		test.equal(aws.spies.SignersV4[0][0], aws.spies.handleRequest[0][0]);
		test.same(aws.spies.handleRequest[0][0], {
			method: 'POST',
			path: 'test',
			region: 'eu-west-1',
			headers: {
				'presigned-expires': false,
				Host: 'aws-host'
			}
		});
		test.end();
	});
});

tap.test('assert request parameters with string message', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData) {
			var emitter = new EventEmitter();
			emitter.statusCode = 400;
			onData(emitter);

			process.nextTick(function () {
				emitter.emit('end');
			});
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'HEAD',
		message: 'some message'
	}, function () {
		test.equal(aws.spies.handleRequest[0][0].method, 'HEAD');
		test.equal(aws.spies.handleRequest[0][0].body, 'some message');
		test.end();
	});
});

tap.test('assert request parameters with JSON message', function (test) {
	var aws = AWS({
		handleRequest: function (request, _, onData) {
			var emitter = new EventEmitter();
			emitter.statusCode = 400;
			onData(emitter);

			process.nextTick(function () {
				emitter.emit('end');
			});
		}
	});
	var es = elastic(aws, testConfig);
	es.send({
		method: 'whatever',
		message: {
			type: 'json'
		}
	}, function () {
		test.equal(aws.spies.handleRequest[0][0].method, 'WHATEVER');
		test.equal(aws.spies.handleRequest[0][0].body, JSON.stringify({
			type: 'json'
		}));
		test.end();
	});
});
