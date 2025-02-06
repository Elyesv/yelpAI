/* Amplify Params - DO NOT EDIT
  ENV
  REGION
  STORAGE_RESTAURANTS_ARN
  STORAGE_RESTAURANTS_NAME
  STORAGE_RESTAURANTS_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);

  if (!process.env.STORAGE_RESTAURANTS_NAME) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Table name is missing in environment variables" }),
    };
  }

  try {
    const { Items } = await docClient.send(
      new ScanCommand({ TableName: process.env.STORAGE_RESTAURANTS_NAME })
    );

    if (!Items || Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "No items found in the database" }),
      };
    }

    const filteredItems = Items.filter(
      (item) => item.average_feeling === "positif" && item.word_cloud
    );

    if (filteredItems.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "No matching items found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(filteredItems),
    };
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
