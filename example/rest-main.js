module.exports.handler = async (event, context) => {
    return new Promise((resolve) => 
        {
            setTimeout(() => resolve({
                statusCode:200,
                body: JSON.stringify({event, context})
            }
            ), 0);
        }
    )
}