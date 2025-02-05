/* Amplify Params - DO NOT EDIT
  ENV
  REGION
  STORAGE_REVIEWS_ARN
  STORAGE_REVIEWS_NAME
  STORAGE_REVIEWS_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  const restaurantId = event.queryStringParameters?.restaurant_id;

  if (!restaurantId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing restaurant_id parameter" }),
    };
  }

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);

  const command = new ScanCommand({
    TableName: process.env.STORAGE_REVIEWS_NAME,
    FilterExpression: "restaurant_id = :restaurant_id",
    ExpressionAttributeValues: {
      ":restaurant_id": restaurantId,
    },
  });

  try {
    const { Items } = await docClient.send(command);

    if (!Items || Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "No reviews found for this restaurant" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(Items),
    };
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};
