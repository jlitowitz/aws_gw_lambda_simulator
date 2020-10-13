
const parser = require('sls-yaml');
const express = require('express');
const bodyParser = require('body-parser');
const querystring = require('querystring');

const httpProxyWrapper = require('./httpProxy');

const defaultOptions = {
  service: {
    httpPort: 8000,
    wsPort: 3000,
    x_api_key: ''
  },
  yaml: {
    serverless: undefined,
    parent: undefined,
    context: undefined
  }
}

function aws_gw_lambda_simulator(serverless, options = {}) {
  this.options = { ...defaultOptions };
  Object.assign(this.options.service, options.service);
  Object.assign(this.options.yaml, options.yaml);

  if (!serverless) {
    throw new Error("serverless must be defined");
  }

  const parsedSls = parser.readYamlSync(serverless, this.options.yaml.parent, this.options.yaml.context);

  // Set up basic REST routes
  this.httpApp = express();
  this.httpApp.use(bodyParser.json());
  this.router = express.Router();

  const functions = parsedSls.functions;
  const funcNames = Object.getOwnPropertyNames(functions);
  funcNames.forEach((name) => {
    const handler = loadHandler(functions[name].handler);
    const events = functions[name].events;
    if (events) {
      events.filter(event => event.http).forEach(event => {
        const { path, method } = event.http;
        this.router[method](path, async (req, res) => {
          if (event.http.private && (!this.options.service.x_api_key || !(this.options.service.x_api_key === req.get("x-api-key")))) {
            return res.status(403).send("Forbidden");
          }

          let authorizerOutput = undefined;

          if (event.http.authorizer) {
            if (!(event.http.authorizer.name && functions[event.http.authorizer.name])) {
              return res.status(500).send("Invalid authorizer specification");
            }
            const authHandler = loadHandler(functions[event.http.authorizer.name].handler);


            const authEvent = {
              type: "REQUEST",
              methodArn: `arn:aws:execute-api:us-east-1:000000000000:0000000000/stage/${event.http.method.toUpperCase()}/`,
              resource: req.path,
              path: req.path,
              httpMethod: req.method,
              headers: Object.getOwnPropertyNames(req.headers).length > 0 ? req.headers : {},
              // "multiValueHeaders": {},
              queryStringParameters: Object.getOwnPropertyNames(req.query).length > 0 ? req.query : {},
              // "queryStringParameters": {},
              // "multiValueQueryStringParameters": {},
              pathParameters: Object.getOwnPropertyNames(req.params).length > 0 ? req.params : {},
              // "pathParameters": {},
              // "stageVariables": {},
              requestContext: {
                stage: 'local',
                domainName: req.headers.host,
                apiId: "0000000000"
              },
            };
            const authContext = {
              callbackWaitsForEmptyEventLoop: true,
              functionVersion: "$LATEST",
              functionName: event.http.authorizer.name,
              memoryLimitInMB: "128",
              logGroupName: `/aws/lambda/echoFunction${event.http.authorizer.name}`,
              logStreamName: "2020/10/09/[$LATEST]00000000000000000000000000000000",
              invokedFunctionArn: `arn:aws:lambda:local:000000000000:function:${event.http.authorizer.name}`,
              awsRequestId: "00000000-0000-0000-0000-000000000000"
            }

            const result = await authHandler(authEvent, authContext);
            // TODO: check all Statement[x].Effect and compare against the current path.
            if (!result || result.policyDocument.Statement.length == 0 || result.policyDocument.Statement[0].Effect != 'Allow') {
              return res.status(403).send("Forbidden");
            }

            authorizerOutput = result.context;
          }

          const proxy = httpProxyWrapper(method, req);
          proxy.event.requestContext = {
            authorizer : authorizerOutput
          }
          try {
            const result = await handler(proxy.event, proxy.context);
            if (result && result.statusCode) {
              res.status(result.statusCode).json(JSON.parse(result.body));
            }
            else {
              res.status(500).send();
            }
          }
          catch (e) {
            if (e && e.statusCode) {
              res.status(e.statusCode).json(JSON.parse(e.body));
            }
            else {
              res.status(500).json(e || {});
            }
          }
        });
      });
    }
  })

  this.httpApp.use(this.router);


  // set up basic ws routes with callback support
  const WebSocket = require('ws');
  const http = require('http');

  const wsconnections = {};
  this.wsApp = require('express')();
  this.wsServer = http.createServer(this.wsApp);

  // callback support
  // TODO: allow 'local' to be replaced with a stage value?
  this.wsApp.post(`/${parsedSls.provider.stage}/@connections/:id`, async (req, res) => {
    const connectionId = req.params['id'];
    const ws = wsconnections[connectionId];

    try {
      // TODO: Do we need to store the resolve value for any reason?
      await new Promise((resolve, reject) => {
        let msg = '';
        req.on('data', (chunk) => {
          try {
            msg += chunk.toString();
          }
          catch (e) {
            reject({ statusCode: 400 });
          }
        }).on('end', () => {
          if (ws) {
            ws.send(msg);
            return resolve({ statusCode: 200 });
          }
          else {
            return reject({ statusCode: 400 });
          }
        })
      })
      res.status(200).send();
    }
    catch (e) {
      res.status(400).json({ msg: e.message });
    }
  });



  let onConnectHandler;
  let onDisconnectHandler;
  let onDefaultHandler;
  let onAuthorizer;
  let webSocketHandlers = [];
  let webSocketRouteResponses = [];

  funcNames.forEach((name) => {
    const handler = loadHandler(functions[name].handler);
    const events = functions[name].events;

    if (events) {
      events.filter(event => event.websocket).forEach(event => {
        const { route, routeResponseSelectionExpression, authorizer } = event.websocket;
        switch (route) {
          case '$connect':
            onConnectHandler = handler;
            if (authorizer) {
              onAuthorizer = { handler: loadHandler(functions[authorizer.name].handler), name: authorizer.name };
            }
            break;
          case '$disconnect':
            onDisconnectHandler = handler;
            break;
          case '$default':
            onDefaultHandler = handler;
            webSocketRouteResponses['$default'] = routeResponseSelectionExpression; // TODO: merge this with handler into an object in a single array
            break;
          default:
            webSocketHandlers[route] = handler;
            webSocketRouteResponses[route] = routeResponseSelectionExpression; // TODO: merge this with handler into an object in a single array
            break;
        }
      });
    }
  })




  const wss = new WebSocket.Server({ server: this.wsServer });

  wss.on('connection', async function connection(ws, req) {
    const connectionId = `cn${Math.floor(Math.random() * 100000)}==`;
    console.log(`New ws connection: ${connectionId}`);

    wsconnections[connectionId] = ws;
    let authorizerResult;
    let requestContext = {
      stage: parsedSls.provider.stage,
      domainName: req.headers.host,
      connectionId
    }

    const queryStringParameters = querystring.decode(req.url.substring(Math.max(req.url.indexOf('?') + 1, 1)));
    // TODO: this assumes that an authorizer will only ever be attached to the onConnect method
    // If that's not reality, this, along with the determination of onAuthorizer, needs to be adjusted
    if (onConnectHandler) {

      if (onAuthorizer) {

        try {
          authorizerResult = await new Promise(async (resolve, reject) => {
            const methodArn = `arn:aws:lambda:local:000000000000:function:${onAuthorizer.name}`;
            if (onAuthorizer.handler.length < 3) {
              // for those authorizers that return a value, instead of calling a callback...
              const auth = await onAuthorizer.handler({ headers: req.headers, queryStringParameters, requestContext: { connectionId }, methodArn }, null);

              // TODO: this only looks at whether _any_ statement allows ... not necessarily the correct thing to do ...
              if (!auth || !auth.policyDocument || auth.policyDocument.Statement.findIndex(statement => statement.Effect === 'Allow') < 0) {
                reject();
              }
              resolve(auth);
            }
            else {
              // for those authorizers that call the callback...
              onAuthorizer.handler({ headers: req.headers, queryStringParameters, requestContext: { connectionId }, methodArn }, null, async (err, auth) => {
                if (err) {
                  reject();
                }
                else {
                  resolve(auth);
                }
              })
            }
          });

          // API Gateway actually pulls all the context values up for some reason.  So we have to mock that here.
          requestContext.authorizer = { principalId: authorizerResult.principalId, ...authorizerResult.context };
        }
        catch {
          ws.close();
          return;
        }
      }

      try {
        const onConnectResult = await onConnectHandler({ headers: req.headers, queryStringParameters, requestContext });
        if (onConnectResult.statusCode != 200) {
          return ws.close();
        }
      }
      catch {
        return ws.close();
      }
    }




    ws.on('close', () => {
      if (onDisconnectHandler) {
        onDisconnectHandler({ requestContext });
      }
    });

    ws.on('message', async (message) => {
      let response;
      let action;
      let isDefault = false;
      try {
        const rse = parsedSls.provider.websocketsApiRouteSelectionExpression;
        action = JSON.parse(message)[rse.substr(rse.lastIndexOf('.') + 1)];
      }
      catch { }

      try {
        if (action && webSocketHandlers[action]) {
          response = await webSocketHandlers[action]({ requestContext, body: message });
        }
        else if (onDefaultHandler) {
          isDefault = true;
          response = await onDefaultHandler({ requestContext, body: message });
        }
      }
      catch { }

      // TODO: validate the value, not just the existance, of webSocketRouteResponses[action] and respond accordingly?
      const responseRoute = isDefault ? webSocketRouteResponses['$default'] : webSocketRouteResponses[action];
      if (responseRoute && response && response.body && response.statusCode >= 200 && response.statusCode < 300) {
        ws.send(response.body);
      }
    })
  });
}

aws_gw_lambda_simulator.prototype.serve = async function (callback) {
  const httpPort = await new Promise((resolve, reject) => {
    this.httpApp.listen(this.options.service.httpPort, () => {
      resolve(this.options.service.httpPort);
    })
  })

  const wsPort = await new Promise((resolve, reject) => {
    this.wsServer.listen(this.options.service.wsPort, () => {
      resolve(this.options.service.wsPort);
    })
  })

  callback({ httpPort, wsPort })
}

function loadHandler(handlerPath) {
  let handler;
  let pos = handlerPath.lastIndexOf('.');
  while (!handler && pos > 0) {
    let prefix;
    try {
      prefix = handlerPath.substr(0, pos);

      delete require.cache[`${process.cwd()}/${prefix}`]; // force cache delete to ensure fresh lambda...
      const load = require(`${process.cwd()}/${prefix}`)

      handler = load[handlerPath.substr(pos + 1)];
      return handler;
    }
    catch (e) {
      pos = prefix.lastIndexOf('.');
    }
  }
}

module.exports = aws_gw_lambda_simulator;