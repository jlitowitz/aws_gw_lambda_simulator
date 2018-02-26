# AWS API Gateway and Lambda Simulator

## Summary
A basic simulator of AWS API Gateway and Lambda runtime, intended to help in developing and debugging Node-based Lambdas for use in AWS.  Can this be used as a production scaffold?  Probably.  But it was written specifically to help develop Lambdas.

### Why Does this Module Exist?
Because we want to write and debug Lambdas ... but we didn't find an easy-to-use, reusable scaffold that worked for us.  `aws sam local`, `serverless`, and others ... none worked the way we liked.  So we wrote this.

## Basic Usage
Here's an example of basic usage in Node.  After launching the application, point your browser to `http://localhost:3000/echo`, assuming you have a Lambda called `echo` in the same folder as your program entry point, and watch your Lambda run.
```js
const API_GW = require('aws_gw_lambda_simulator');

let server = new API_GW.Server();
let routes = [
    { verb: "GET", filepath: __dirname + '/echo', route: '/echo' }
];

server.config(routes);

server.listen(3000, () => {
    console.log('started on 3000 from js');
});
```

Prefer TypeScript?  So do we!  Here's the same example in TypeScript:
```ts
import { Server, RouteConfig } from 'aws_gw_lambda_simulator';

let server = new Server();
let routes: Array<lambdaRoute> = [
    { verb: HTTP_VERB.GET, filepath: __dirname + '/echo', route: '/echo' }
];

server.config(routes);

server.listen(3000, () => {
    console.log('started on 3000 from ts');
});
```

### CORS
Concerned about CORS restrictions?  Under the hood we use the [cors](https://www.npmjs.com/package/cors) module to handle this.  Simply pass in a CORS configuration object as the optional second parameter to `config`.  For example:
```js
// enable cors
let cors = {
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['x-auth-token']
};

server.config(routes, cors);
```

## Details
**aws_gw_lambda_simulator** uses [express](https://www.npmjs.com/package/express) to spin up a web server.  You pass in an array of routes to expose, as well as optional CORS configuration as described above.  It passes in mock objects that stand in for the `event`, `context`, and `callback` values.  These are not 100% accurate representations of the objects you'll be provided in the true AWS Lambda environment.  Rather, they contain a subset of those fields that have thus far been necessary for our development.

The `config` method requires an array of `lambdaRoutes`.  Each one of these must contain exactly 3 properties:
* `verb` - this is the HTTP verb to listen for.  Currently, only `GET` and `POST` are supported.  If using TypeScript, you can use the enum `HTTP_VERB` to access the possible values:  `HTTP_VERB.GET` or `HTTP_VERB.POST`.  Otherwise, use the values `"GET"` or `"POST"`.
* `filepath` - the path to the entry point file for your Lambda.  Since this file gets loaded via `require`, you don't need to include the trailing '.js' if you don't want to.  You must specify the full path or use `__dirname` to ensure the correct path is used to locate the lambda entry point.  Otherwise, it will attempt to load the file using the node_modules subfolder as the starting point, and will lead you to unexpected results.
* `route` - the URL path to expose the endpoint as.
___
Disclaimer:  this project is not in any way associated with AWS or Amazon!

(c) 2018 Triple Take Technologies