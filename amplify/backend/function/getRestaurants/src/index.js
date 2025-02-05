/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_RESTAURANTS_ARN
	STORAGE_RESTAURANTS_NAME
	STORAGE_RESTAURANTS_STREAMARN
Amplify Params - DO NOT EDIT */

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const { Items } = await docClient.scan({
      TableName: process.env.STORAGE_RESTAURANTS_NAME,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(Items),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};
