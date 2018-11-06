/*
Copyright 2018 Triple Take Technologies

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import * as express from 'express';
import * as url from 'url';
import { HTTP_VERB, gwOptions } from './types/lambdaRoute';

// A wrapper function to handle the basic input/output for a lambda
export function Wrapper(lambda: lambdaInterface, verb: HTTP_VERB, req: express.Request, res: express.Response, options?: gwOptions) : express.Response {
    if (options && options.x_api_key && !(options.x_api_key === req.get("x-api-key"))) {
        let r = res.status(403);
        r.send("Forbidden");
        return r;
    }

    const { event, context } = Mapper(verb, req);

    if (options && options.tokenAuthorizer) {
        const mockAuth = new mockAuthorizationEvent();
        mockAuth.authorizationToken = req.get(options.tokenAuthorizer.header_key);
        if (mockAuth.authorizationToken == null) {
            return res.status(401).send();
        }

        const authorizer : lambdaAuthorizerInterface = require(options.tokenAuthorizer.filepath);
        authorizer.handler(mockAuth, context, (err, result) => {
            if (err) {
                return res.status(401).send();
            }
            // TODO: iterate over all Statemet[x].Effect values
            else if (result.policyDocument.Statement[0].Effect === 'Deny') {
                return res.status(403).send();
            }
            else if (result.policyDocument.Statement[0].Effect === 'Allow') {
                context.authorizer = {};
                context.authorizer.principalId = result.principalId;
                for (var key in result.context) {
                    context.authorizer[key] = String(result.context[key]); // the context map is stringified in API Gateway
                }
                // TODO:  eliminate this duplicate code block
                return lambda.handler(event, context, (err, result) => {
                    if (err) {
                        return res.status(502).json({ err });
                    }
            
                    return res.status(result.statusCode).json(result.body);
                })
            }
            else {
                return res.status(500).send();
            }
    
        })
    }

    else {
            // TODO:  eliminate this duplicate code block
            lambda.handler(event, context, (err, result) => {
            if (err) {
                return res.status(502).json({ err });
            }
    
            return res.status(result.statusCode).json(result.body);
        })            
    }
}

export class mockContext implements AWSLambda.Context {
    callbackWaitsForEmptyEventLoop: boolean;
    functionName: string;
    functionVersion: string;
    invokedFunctionArn: string;
    memoryLimitInMB: number;
    awsRequestId: string;
    logGroupName: string;
    logStreamName: string;
    identity?: AWSLambda.CognitoIdentity;
    clientContext?: AWSLambda.ClientContext;
    getRemainingTimeInMillis(): number {
        throw new Error("Mock method not implemented.");
    }
    done(error?: Error, result?: any): void {
        throw new Error("Mock method not implemented.");
    }
    fail(error: string | Error): void {
        throw new Error("Mock method not implemented.");
    }
    succeed(messageOrObject: any): void;
    succeed(message: string, object: any): void;
    succeed(message: any, object?: any) {
        throw new Error("Mock method not implemented.");
    }
    authorizer? : any;
}

export class mockEvent implements AWSLambda.APIGatewayEvent {
    body: string;
    headers: { [name: string]: string; };
    httpMethod: string;
    isBase64Encoded: boolean;
    path: string;
    pathParameters: { [name: string]: string; };
    queryStringParameters: { [name: string]: string; };
    stageVariables: { [name: string]: string; };
    requestContext: AWSLambda.APIGatewayEventRequestContext;
    resource: string;
}

class mockAuthorizationEvent implements AWSLambda.CustomAuthorizerEvent {
    type: string;
    methodArn: string;
    authorizationToken?: string;
    // headers?: { [name: string]: string };
    // pathParameters?: { [name: string]: string } | null;
    // queryStringParameters?: { [name: string]: string } | null;
    // requestContext?: AWSLambda.APIGatewayEventRequestContext;
}

// Mimic the subset of the event and context objects created by AWS' Lambda Proxy for the specified request (req)
export function Mapper(verb: HTTP_VERB,req: express.Request) {

    const context = new mockContext();
    const event = new mockEvent();
    Object.assign(event, {
        resource: req.route.path,
        path: url.parse(req.url).pathname,
        queryStringParameters: Object.getOwnPropertyNames(req.query).length > 0 ? req.query : null,
        pathParameters: Object.getOwnPropertyNames(req.params).length > 0 ? req.params : null,
        httpMethod: verb,
        headers: Object.getOwnPropertyNames(req.headers).length > 0 ? req.headers : null,
        body: req.body
    })

    return ({ context, event });
}
