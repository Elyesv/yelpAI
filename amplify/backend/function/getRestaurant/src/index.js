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
const fetch = require("node-fetch");

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
    // Récupérer les infos du restaurant
    const restaurantData = await getRestaurantData(restaurantId);
    if (!restaurantData) {
      return { statusCode: 404, body: JSON.stringify({ message: "Restaurant not found" }) };
    }

    // Récupérer les avis et les évaluations
    const { ratings, feelingsCounts } = await getReviewsData(restaurantId);

    // Graphiques avec QuickChart
    const ratingsChartBuffer = await generateChartBuffer("ratings", ratings);
    const feelingsChartBuffer = await generateChartBuffer("feelings", feelingsCounts);

    // Génération du PDF
    const pdfBuffer = await generatePDF(ratingsChartBuffer, feelingsChartBuffer);

    // Upload sur S3
    const s3Url = await uploadToS3(pdfBuffer, restaurantId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "PDF created and uploaded successfully",
        pdfUrl: s3Url,
      }),
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal Server Error", error: error.message }) };
  }
};

// Helper functions

// Get restaurant data
const getRestaurantData = async (restaurantId) => {
  const queryRestaurantCommand = new QueryCommand({
    TableName: process.env.STORAGE_RESTAURANTS_NAME,
    KeyConditionExpression: "id = :restaurantId",
    ExpressionAttributeValues: { ":restaurantId": restaurantId },
  });
  const restaurantData = await docClient.send(queryRestaurantCommand);
  return restaurantData.Items?.[0] || null;
};

// Get reviews data
const getReviewsData = async (restaurantId) => {
  const scanReviewsCommand = new ScanCommand({
    TableName: process.env.STORAGE_REVIEWS_NAME,
    FilterExpression: "restaurant_id = :restaurant_id",
    ExpressionAttributeValues: { ":restaurant_id": restaurantId },
  });
  const reviewsData = await docClient.send(scanReviewsCommand);
  const ratings = reviewsData.Items?.map(item => item.rating) || [];
  const feelings = reviewsData.Items?.map(item => item.feeling) || [];

  const feelingsCounts = {
    positive: feelings.filter(f => f === "positif").length,
    negative: feelings.filter(f => f === "negatif").length,
    neutral: feelings.filter(f => f === "neutre").length,
    empty: feelings.filter(f => !f).length,
  };

  return { ratings, feelingsCounts };
};

// Generate chart buffer
const generateChartBuffer = async (type, data) => {
  let chartUrl = "";
  if (type === "ratings") {
    chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
      type: "bar",
      data: {
        labels: ["1⭐", "2⭐", "3⭐", "4⭐", "5⭐"],
        datasets: [{
          label: "Nombre d’avis",
          data: [1, 2, 3, 4, 5].map(r => data.filter(x => x === r).length),
          backgroundColor: ["red", "orange", "yellow", "green", "blue"]
        }]
      }
    }))}`;
  } else if (type === "feelings") {
    chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
      type: "bar",
      data: {
        labels: ["Positif", "Négatif", "Neutre", "Vide"],
        datasets: [{
          label: "Répartition des sentiments",
          data: Object.values(data),
          backgroundColor: ["green", "red", "gray", "lightgray"]
        }]
      }
    }))}`;
  }
  return fetchImageBuffer(chartUrl);
};


// Generate PDF buffer
const generatePDF = async (ratingsChartBuffer, feelingsChartBuffer) => {
  console.log("ratingsChartBuffer:", ratingsChartBuffer);
  console.log("feelingsChartBuffer:", feelingsChartBuffer);

  if (!ratingsChartBuffer || !feelingsChartBuffer) {
    throw new Error('One or more chart buffers are undefined or invalid');
  }

  const pdf = new jsPDF();
  pdf.text("Restaurant Reviews - Ratings", 10, 10);
  pdf.addImage(Buffer.from(ratingsChartBuffer), "PNG", 10, 20, 100, 75);
  pdf.addPage();
  pdf.text("Sentiment Distribution", 10, 10);
  pdf.addImage(Buffer.from(feelingsChartBuffer), "PNG", 10, 20, 100, 75);
  return pdf.output("arraybuffer");
};

// Upload PDF to S3
const uploadToS3 = async (pdfBuffer, restaurantId) => {
  const s3Params = {
    Bucket: process.env.STORAGE_PDF_BUCKETNAME,
    Key: `restaurant-${restaurantId}-reviews.pdf`,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  };
  await s3Client.send(new PutObjectCommand(s3Params));

  const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: s3Params.Bucket,
    Key: s3Params.Key
  }), { expiresIn: 3600 });

  return signedUrl;
};

// Helper function to fetch image buffer from QuickChart URL
const fetchImageBuffer = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from QuickChart with URL: ${url}`);
    }
    const imageBuffer = await response.buffer();
    return imageBuffer;
  } catch (error) {
    console.error('Error fetching image buffer:', error);
    throw error;
  }
};
