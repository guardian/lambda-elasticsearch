# Lambda to Elasticsearch

Module to stream data to Elasticsearch from a lambda function.

Heavily inspired by [aws samples](https://github.com/awslabs/amazon-elasticsearch-lambda-samples).

## Install

```
npm install --save lambda-elasticsearch
```

## Usage

```js
var AWS = require('aws-sdk');
var elastic = require('lambda-elasticsearch')(AWS, {
	endpoint: 'your.elasticsearch.es.amazon.com',
	region: 'eu-west-1'
});

elastic.send({
	method: 'GET',
	path: '/domain/index/id'
}, function (err, data) {
	console.log(data);
});
```

### Advanced usage

By default the module expects a JSON response. If you're expecting plain text you can call

```js
elastic.send({
	method: 'GET',
	path: '/_cat/indices',
	json: false
}, function (err, data) {
	console.log(data); // as plain text
});
```

If `json:true` and the response is not a valid JSON, the callback receives an error containing `responseText` for debug purposes.

## Contribute

Clone the repo, write some test, make them pass and pull request your changes.

You can watch your tests by running

```js
npm install -g watch
watch "npm test" . -d
```
