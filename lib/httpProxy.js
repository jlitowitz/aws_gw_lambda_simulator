const url = require('url');
const { mockContext, mockEvent } = require('./mocks');

module.exports = (verb, req) => {
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
