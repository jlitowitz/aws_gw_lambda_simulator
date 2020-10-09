module.exports = {
    handler: async (event, context) => {
        const username = event.queryStringParameters['username'];
        if (username) {
            return generateAllow(`ab.c`, event.methodArn, {
                providerName : 'ab',
                username
            });    
        }
        else {
            return null;
        }
    }
}



// Help function to generate an IAM policy
var generatePolicy = function (principalId, effect, resource, data) {
    // Required output:
    var authResponse = {};
    authResponse.principalId = principalId;
    if (effect && resource) {
        var policyDocument = {};
        policyDocument.Version = '2012-10-17'; // default version
        policyDocument.Statement = [];
        var statementOne = {};
        statementOne.Action = 'execute-api:Invoke'; // default action
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
 
    authResponse.context = data;
    return authResponse;
}

var generateAllow = function (principalId, resource, data) {
    return generatePolicy(principalId, 'Allow', resource, data);
}
