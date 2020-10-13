# AWS API Gateway and Lambda Simulator v2

## Summary
A basic simulator of AWS API Gateway and Lambda runtime, intended to help in developing and debugging Node-based Lambdas for use in AWS from behind API Gateway, both REST and Websockets.  All configuration is controlled by a [Serverless](https://www.serverless.com) `yaml` file.

## Breaking Changes
This was completely rewritten from the ground up.  It is wholly incompatible with pre-v2 versions.  Apologies to anyone who was using the old one ... but honestly, that wasn't too many of you.

### Important Changes From Earlier Versions
As our development efforts progressed, we increasingly became reliant upon [Serverless](https://www.serverless.com) to control our deployments.  It eventually became logical for us to rewrite this module to rely upon `serverless.yml` to be the single source of truth of our Lambdas.

## Installation
```
npm install aws_gw_lambda_simulator
```

## Basic REST Example
First things first, create a simple `serverless.yml` file:
```yaml
# serverless.yml
service: echo_service

provider:
  name: aws
  runtime: nodejs12.x

functions:

  restHandlerFunc:
    handler: echo.handler
    events:
      - http:
          path: /
          method: get
```
Next, create your barebones scaffold:
```javascript
// index.js
const API_GW = require('aws_gw_lambda_simulator');

const api_gw = new API_GW('./serverless.yml');

api_gw.serve(({httpPort, wsPort}) => { console.log(`listening http on ${httpPort} and ws on ${wsPort}`); });
```
Finally, create your lambda function.  In this case, `serverless.yml` defines the handler as the `handler` method in `echo.js`:
```javascript
// echo.js
module.exports.handler = (event, context) => {
    return {
        statusCode:200,
        body: JSON.stringify({event, context})
    }
```
Start debugging using your favorite editor (ex: [Visual Studio Code](https://code.visualstudio.com/)), and you'll be able to easily set breakpoints and step through your code.

By default, the web service will listen on port 8000.

## Basic Websocket Example
Instead of - or even in addition to - REST services, `aws_gw_lambda_simulator` can simulate API Gateway's support for Websockets.  Implementing this is as simple as expanding `serverless.yml` to indicate the `websocketsApiRouteSelectionExpression` and the handlers.
```yaml
service: echo_service

provider:
  name: aws
  runtime: nodejs12.x

  # define the property used for auto-routing of websocket messages
  websocketsApiRouteSelectionExpression: $request.body.action

functions:

  restHandlerFunc:
    handler: echo.handler
    events:
      - http:
          path: /
          method: get
      # define a websocket handler
      - websocket:
          route: message
          routeResponseSelectionExpression: $default
```

## Parameters to API_GW constructor

`API_GW` accepts two parameters:
- `serverless`: a path to a `serverless.yml` file.  Required.
- `options`: a configuration object.  Optional.  If `options` may contain either or both of the following optional properties:
    - `service`: configuration parameters for the service listener.  Valid optional parameters include the following.
        - `httpPort`: The port # to listen on for REST services.  Defaults to 8000.
        - `wsPort`: The port # to listen on for Websocket connections.  Defaults to 3000.
        - `x_api_key`: The value to use to simulate a required API Key.  Defaults to an empty string.

    - `yaml`: parameters to pass into [sls-yaml](https://github.com/01alchemist/sls-yaml), the parse engine used for reading `serverless.yml`.  Valid optional parameters include the following.  See [sls-yaml](https://github.com/01alchemist/sls-yaml) for more information on their meaning.
        - `context` - See the [example](./example/) for a way of using `context` to support the `opt` flag within `serverless.yml`
        - `parent`

## API_GW.serve 
To start listening, call `api_gw.serve()`.  This method accepts a single parameter - a callback method that expects an object containing two parameters:  `httpPort` and  `wsPort`.  These are the port numbers that the service is listening on for REST and Websockets, respectively.  These can be used as follows:
```javascript
api_gw.serve(({httpPort, wsPort}) => { 
    console.log(`listening http on ${httpPort} and ws on ${wsPort}`); 
});
```

## Authorizer Support
Basic simulation of authorizers is supported for both REST and Websocket connections.
### REST Authorizer Support
Simply define your authorizer function and reference it as you normally would in `serverless.yml`.  The following code is taken from the included [example](./example).
```yaml
  restAuthorizerFunc:
    handler: rest-auth.handler

  restHandlerFunc:
    handler: rest-main.handler
    events:
      - http:
          path: /
          method: get
      - http:
          path: /
          method: post
          private: true
          authorizer:
            name: restAuthorizerFunc
            identitySource: method.request.header.x-api-key
            type: request
```
### Websocket Authorizer Support
Similarly, simply define your authorizer and onConnect functions and reference them as you normally would in `serverless.yml`.  The following code is taken from the included [example](./example).
```yaml
  websocketConnectionHandler:
    handler:  ws-main.onConnect
    events:
      - websocket:
          route: $connect
          routeResponseSelectionExpression: $default
          authorizer:
            name: websocketAuth
            identitySource:
              - 'route.request.querystring.code'

  websocketAuth:
    handler: ws-auth.handler
```
