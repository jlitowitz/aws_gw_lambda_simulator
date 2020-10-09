module.exports = {
    mockContext: function() {
        this.callbackWaitsForEmptyEventLoop = false;
        this.functionName = "";
        this.functionVersion = "";
        this.invokedFunctionArn = "";
        this.memoryLimitInMB = "";
        this.awsRequestId = "";
        this.logGroupName = "";
        this.logStreamName = "";
        this.identity = undefined;
        this.clientContext = undefined;
        this.getRemainingTimeInMillis = () => {
            throw new Error("Mock method not implemented.");
        }
        this.done = (error, result) => {
            throw new Error("Mock method not implemented.");
        }
        this.fail = (error) => {
            throw new Error("Mock method not implemented.");
        }
        this.succeed = (message, object) => {
            throw new Error("Mock method not implemented.");
        }
        this.authorizer = undefined;
    },
    mockEvent : function() {
        this.body = "";
        this.headers = { };
        this.httpMethod = "";
        this.isBase64Encoded = false;
        this.path = "";
        this.pathParameters = {  };
        this.queryStringParameters = { };
        this.stageVariables = { };
        this.requestContext = undefined;
        this.resource = "";
    }
    
}

