module.exports = {
    onConnect : async (event, context) => {
        return {
            statusCode : 200
        }
    },

    onMessage : async (event, context) => {
        const body = JSON.parse(event.body);
        return {
            statusCode : 200,
            body : JSON.stringify(`hello, ${body.name}`)
        }
    }

}