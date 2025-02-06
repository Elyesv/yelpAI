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
const {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { jsPDF } = require("jspdf");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fetch = require("node-fetch");

const s3Client = new S3Client({ region: process.env.REGION });
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);

  const restaurantId = event.queryStringParameters?.restaurant_id;
  if (!restaurantId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing restaurant_id parameter" }),
    };
  }

  try {
    // Récupérer les infos du restaurant
    const queryRestaurantCommand = new QueryCommand({
      TableName: process.env.STORAGE_RESTAURANTS_NAME,
      KeyConditionExpression: "id = :restaurantId",
      ExpressionAttributeValues: { ":restaurantId": restaurantId },
    });
    const restaurantData = await docClient.send(queryRestaurantCommand);
    if (!restaurantData.Items?.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Restaurant not found" }),
      };
    }

    // Extraction sécurisée du word_cloud
    const wordCloudRaw = restaurantData.Items[0]?.word_cloud || [];
    const wordCloud = Array.isArray(wordCloudRaw)
      ? wordCloudRaw.map(([word, count]) => ({ word, count }))
      : [];

    // Récupérer les avis et les évaluations
    const scanReviewsCommand = new ScanCommand({
      TableName: process.env.STORAGE_REVIEWS_NAME,
      FilterExpression: "restaurant_id = :restaurant_id",
      ExpressionAttributeValues: { ":restaurant_id": restaurantId },
    });
    const reviewsData = await docClient.send(scanReviewsCommand);
    const ratings = reviewsData.Items?.map((item) => item.rating) || [];
    const feelings = reviewsData.Items?.map((item) => item.feeling) || []; // Récupérer les sentiments

    // Analyser les sentiments
    const feelingsCounts = {
      positive: feelings.filter((f) => f === "positif").length,
      negative: feelings.filter((f) => f === "negatif").length,
      neutral: feelings.filter((f) => f === "neutre").length,
      empty: feelings.filter((f) => !f).length, // vide ou null
    };

    // Générer le graphique des évaluations
    const ratingsChartConfig = {
      type: "bar",
      data: {
        labels: ["1⭐", "2⭐", "3⭐", "4⭐", "5⭐"],
        datasets: [
          {
            label: "Nombre d’avis",
            data: [
              ratings.filter((r) => r === 1).length,
              ratings.filter((r) => r === 2).length,
              ratings.filter((r) => r === 3).length,
              ratings.filter((r) => r === 4).length,
              ratings.filter((r) => r === 5).length,
            ],
            backgroundColor: ["red", "orange", "yellow", "green", "blue"],
          },
        ],
      },
    };
    const ratingsChartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
      JSON.stringify(ratingsChartConfig)
    )}`;
    const ratingsChartImage = await fetch(ratingsChartUrl);
    const ratingsChartBuffer = await ratingsChartImage.arrayBuffer();

    // Générer le graphique des sentiments
    const feelingsChartConfig = {
      type: "bar",
      data: {
        labels: ["Positif", "Négatif", "Neutre", "Vide"],
        datasets: [
          {
            label: "Répartition des sentiments",
            data: [
              feelingsCounts.positive,
              feelingsCounts.negative,
              feelingsCounts.neutral,
              feelingsCounts.empty,
            ],
            backgroundColor: ["green", "red", "gray", "lightgray"],
          },
        ],
      },
    };
    const feelingsChartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
      JSON.stringify(feelingsChartConfig)
    )}`;
    const feelingsChartImage = await fetch(feelingsChartUrl);
    const feelingsChartBuffer = await feelingsChartImage.arrayBuffer();

    // Création du PDF
    const pdf = new jsPDF();
    pdf.text("Restaurant Reviews - Rating Graph", 10, 10);
    pdf.addImage(Buffer.from(ratingsChartBuffer), "PNG", 10, 20, 100, 75);

    // Ajouter le graphique des sentiments
    pdf.text("Sentiment Distribution", 10, 110);
    pdf.addImage(Buffer.from(feelingsChartBuffer), "PNG", 10, 120, 100, 75);

    // Ajouter les sentiments (feelings) s'il y en a
    let yPos = 200;
    if (feelings.length > 0) {
      pdf.text("Sentiments / Feelings:", 10, yPos);
      yPos += 10;
      feelings.forEach((feeling) => {
        pdf.text(`${feeling}`, 10, yPos);
        yPos += 10;
      });
    }

    // Ajouter le nuage de mots
    if (wordCloud.length > 0) {
      pdf.text("Word Cloud:", 10, yPos);
      yPos += 10;
      wordCloud.forEach(({ word, count }) => {
        pdf.text(`${word}: ${count}`, 10, yPos);
        yPos += 10;
      });
    }

    // Uploader sur S3
    const pdfBuffer = pdf.output("arraybuffer");
    const s3Params = {
      Bucket: process.env.STORAGE_PDF_BUCKETNAME,
      Key: `restaurant-${restaurantId}-reviews.pdf`,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    };
    await s3Client.send(new PutObjectCommand(s3Params));

    // Générer une URL pré-signée
    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: s3Params.Bucket,
        Key: s3Params.Key,
      }),
      { expiresIn: 3600 }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "PDF created and uploaded successfully",
        pdfUrl: s3Url,
      }),
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
    };
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
  const ratings = reviewsData.Items?.map((item) => item.rating) || [];
  const feelings = reviewsData.Items?.map((item) => item.feeling) || [];

  const feelingsCounts = {
    positive: feelings.filter((f) => f === "positif").length,
    negative: feelings.filter((f) => f === "negatif").length,
    neutral: feelings.filter((f) => f === "neutre").length,
    empty: feelings.filter((f) => !f).length,
  };

  return { ratings, feelingsCounts };
};

// Generate chart buffer
const generateChartBuffer = async (type, data) => {
  let chartUrl = "";
  if (type === "ratings") {
    chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
      JSON.stringify({
        type: "bar",
        data: {
          labels: ["1⭐", "2⭐", "3⭐", "4⭐", "5⭐"],
          datasets: [
            {
              label: "Nombre d’avis",
              data: [1, 2, 3, 4, 5].map(
                (r) => data.filter((x) => x === r).length
              ),
              backgroundColor: ["red", "orange", "yellow", "green", "blue"],
            },
          ],
        },
      })
    )}`;
  } else if (type === "feelings") {
    chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
      JSON.stringify({
        type: "bar",
        data: {
          labels: ["Positif", "Négatif", "Neutre", "Vide"],
          datasets: [
            {
              label: "Répartition des sentiments",
              data: Object.values(data),
              backgroundColor: ["green", "red", "gray", "lightgray"],
            },
          ],
        },
      })
    )}`;
  }
  return fetchImageBuffer(chartUrl);
};

// Generate PDF buffer
const generatePDF = async (ratingsChartBuffer, feelingsChartBuffer) => {
  console.log("ratingsChartBuffer:", ratingsChartBuffer);
  console.log("feelingsChartBuffer:", feelingsChartBuffer);

  if (!ratingsChartBuffer || !feelingsChartBuffer) {
    throw new Error("One or more chart buffers are undefined or invalid");
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

  const signedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: s3Params.Bucket,
      Key: s3Params.Key,
    }),
    { expiresIn: 3600 }
  );

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
    console.error("Error fetching image buffer:", error);
    throw error;
  }
};
