/* Amplify Params - DO NOT EDIT
  AUTH_YELPAI8AD9ABBE_USERPOOLID
  ENV
  REGION
  STORAGE_PDF_BUCKETNAME
  STORAGE_RESTAURANTS_ARN
  STORAGE_RESTAURANTS_NAME
  STORAGE_RESTAURANTS_STREAMARN
  STORAGE_REVIEWS_ARN
  STORAGE_REVIEWS_NAME
  STORAGE_REVIEWS_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { jsPDF } = require("jspdf");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fetch = require("node-fetch"); // Pour récupérer l'image QuickChart

const s3Client = new S3Client({ region: process.env.REGION });
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  const restaurantId = event.queryStringParameters?.restaurant_id;

  if (!restaurantId) {
    return { statusCode: 400, body: JSON.stringify({ message: "Missing restaurant_id parameter" }) };
  }

  try {
    const queryRestaurantCommand = new QueryCommand({
      TableName: process.env.STORAGE_RESTAURANTS_NAME,
      KeyConditionExpression: "id = :restaurantId",
      ExpressionAttributeValues: { ":restaurantId": restaurantId },
    });
    const restaurantData = await docClient.send(queryRestaurantCommand);
    if (!restaurantData.Items?.length) {
      return { statusCode: 404, body: JSON.stringify({ message: "Restaurant not found" }) };
    }

    const scanReviewsCommand = new ScanCommand({
      TableName: process.env.STORAGE_REVIEWS_NAME,
      FilterExpression: "restaurant_id = :restaurant_id",
      ExpressionAttributeValues: { ":restaurant_id": restaurantId },
    });
    const reviewsData = await docClient.send(scanReviewsCommand);
    const ratings = reviewsData.Items?.map(item => item.rating) || [];

    const chartConfig = {
      type: "bar",
      data: {
        labels: ["1⭐", "2⭐", "3⭐", "4⭐", "5⭐"],
        datasets: [{
          label: "Nombre d’avis",
          data: [ratings.filter(r => r === 1).length, ratings.filter(r => r === 2).length,
          ratings.filter(r => r === 3).length, ratings.filter(r => r === 4).length,
          ratings.filter(r => r === 5).length],
          backgroundColor: ["red", "orange", "yellow", "green", "blue"]
        }]
      }
    };
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
    const chartImage = await fetch(chartUrl);
    const imageBuffer = await chartImage.arrayBuffer();

    const pdf = new jsPDF();
    pdf.text("Restaurant Reviews - Rating Graph", 10, 10);
    pdf.addImage(Buffer.from(imageBuffer), 'PNG', 10, 20, 100, 75);

    const pdfBuffer = pdf.output('arraybuffer');
    const s3Params = {
      Bucket: process.env.STORAGE_PDF_BUCKETNAME,
      Key: `restaurant-${restaurantId}-reviews.pdf`,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    };
    await s3Client.send(new PutObjectCommand(s3Params));

    const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: s3Params.Bucket,
      Key: s3Params.Key
    }), { expiresIn: 3600 });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "PDF created and uploaded successfully",
        pdfUrl: signedUrl,
      }),
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal Server Error", error: error.message }) };
  }
};
