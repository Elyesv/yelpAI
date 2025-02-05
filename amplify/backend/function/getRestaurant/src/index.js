/* Amplify Params - DO NOT EDIT
  ENV
  REGION
  STORAGE_RESTAURANTS_ARN
  STORAGE_RESTAURANTS_NAME
  STORAGE_RESTAURANTS_STREAMARN
  STORAGE_REVIEWS_ARN
  STORAGE_REVIEWS_NAME
  STORAGE_REVIEWS_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

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

  try {
    // Récupérer les informations du restaurant
    const queryRestaurantCommand = new QueryCommand({
      TableName: process.env.STORAGE_RESTAURANTS_NAME,
      KeyConditionExpression: "id = :restaurantId",
      ExpressionAttributeValues: {
        ":restaurantId": restaurantId,
      },
    });

    const restaurantData = await docClient.send(queryRestaurantCommand);

    if (!restaurantData.Items || restaurantData.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Restaurant not found" }),
      };
    }

    // Récupérer les reviews associées
    const scanReviewsCommand = new ScanCommand({
      TableName: process.env.STORAGE_REVIEWS_NAME,
      FilterExpression: "restaurant_id = :restaurant_id",
      ExpressionAttributeValues: {
        ":restaurant_id": restaurantId,
      },
    });

    const reviewsData = await docClient.send(scanReviewsCommand);

    // Combiner les résultats dans une seule réponse
    const response = {
      restaurant: restaurantData.Items[0], // Récupère le premier restaurant (en supposant qu'il est unique)
      reviews: reviewsData.Items || [], // Ajoute les reviews trouvées ou un tableau vide
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};
