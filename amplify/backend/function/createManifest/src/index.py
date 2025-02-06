import json
import boto3
import time
import os
import decimal

# Initialisation des clients AWS
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

# Récupération des variables d'environnement définies par Amplify
TABLE_NAME = os.environ["STORAGE_RESTAURANTS_NAME"]
BUCKET_NAME = os.environ["STORAGE_PDF_BUCKETNAME"]

def decimal_default(obj):
    """ Convertit Decimal en float pour éviter les erreurs JSON. """
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    raise TypeError("Type non sérialisable")

def handler(event, context):
    try:
        # 1️⃣ Récupération des données de DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        response = table.scan()
        print(response)

        timestamp = int(time.time())
        json_file_name = f"data-{timestamp}.json"
        manifest_file_name = f"manifest-{timestamp}.manifest"

        # 2️⃣ Transformation des données et conversion des Decimal en float
        data_restaurant = response.get("Items", [])

        # 3️⃣ Encodage JSON avec gestion de Decimal
        data_rest_format = json.dumps(
            data_restaurant, ensure_ascii=False, default=decimal_default, indent=2
        ).encode("utf-8")

        # 4️⃣ Upload du fichier JSON sur S3
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=json_file_name,
            Body=data_rest_format,
            ContentType="application/json"
        )

        # 5️⃣ Création du fichier manifest
        manifest_template = json.dumps({
            "fileLocations": [{"URIs": [f"s3://{BUCKET_NAME}/{json_file_name}"]}],
            "globalUploadSettings": {"format": "JSON"}
        }, ensure_ascii=False, indent=2).encode("utf-8")

        # 6️⃣ Upload du manifest sur S3
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=manifest_file_name,
            Body=manifest_template,
            ContentType="application/octet-stream"
        )

        # 7️⃣ Retour de succès
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Fichiers JSON et manifest envoyés avec succès"
            })
        }

    except Exception as e:
        print(f"Erreur : {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
