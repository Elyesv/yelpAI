import json
import boto3
from collections import Counter
from analyse_feelings import analyse_feelings
from extract_words import extract_keywords
from boto3.dynamodb.conditions import Attr
import os

# Initialisation de la session AWS
session = boto3.Session(
    aws_access_key_id="",
    aws_secret_access_key="",
    region_name=os.getenv("AWS_REGION", "eu-west-1")
)

dynamodb = session.resource('dynamodb')

# Définition des tables DynamoDB
RESTAURANT_TABLE = dynamodb.Table('restaurants-elyes')
REVIEWS_TABLE = dynamodb.Table('reviews-elyes')

# Définition de la limite stricte de 512 caractères
MAX_CHAR_LENGTH = 512


def truncate_text(text, max_length=MAX_CHAR_LENGTH):
    """
    Tronque le texte à un maximum de `max_length` caractères.
    """
    return text[:max_length] if len(text) > max_length else text


def handler(event):
    """Analyse les sentiments et extrait les mots-clés à partir des avis."""
    reviews = event.get("reviews", [])

    # Vérifier que l'entrée est bien une liste de chaînes
    if not isinstance(reviews, list) or not all(isinstance(r, str) for r in reviews):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid input format. Expected a list of strings."})
        }

    # Tronquer toutes les reviews à 512 caractères MAXIMUM
    truncated_reviews = [truncate_text(r) for r in reviews]

    # Vérification après tronquage
    for i, review in enumerate(truncated_reviews):
        if len(review) > MAX_CHAR_LENGTH:
            print(f"Warning: Review {i} still exceeds {MAX_CHAR_LENGTH} characters after truncation.")

    # Analyse des sentiments pour chaque avis
    feelings = analyse_feelings(truncated_reviews)

    if not feelings or len(feelings) != len(reviews):
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Mismatch in the number of analyzed feelings."})
        }

    # Associer chaque avis à son sentiment
    reviews_with_feelings = [{"review": r, "feeling": f} for r, f in zip(reviews, feelings)]

    # Déterminer le sentiment dominant
    most_common_feeling = Counter(feelings).most_common(1)[0][0]

    # Extraire les mots-clés les plus importants
    word_cloud = extract_keywords(truncated_reviews, top_n=15)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "average_feeling": most_common_feeling,
            "word_cloud": word_cloud,
            "reviews": reviews_with_feelings
        })
    }


def scan_restaurants():
    """Récupère les restaurants sans analyse de sentiment ou mots-clés."""
    response = RESTAURANT_TABLE.scan(
        FilterExpression=Attr('average_feeling').not_exists() | Attr('word_cloud').not_exists()
    )
    return response.get('Items', [])


def get_reviews_for_restaurant(restaurant_id):
    """Récupère les avis d'un restaurant spécifique."""
    response = REVIEWS_TABLE.scan(
        FilterExpression=Attr('restaurant_id').eq(restaurant_id)
    )
    return response.get('Items', [])


def update_review(review_id, feeling):
    """Ajoute le sentiment analysé à un avis spécifique."""
    REVIEWS_TABLE.update_item(
        Key={'id': review_id},
        UpdateExpression="SET feeling = :f",
        ExpressionAttributeValues={':f': feeling}
    )


def update_restaurant(restaurant_id, average_feeling, word_cloud):
    """Met à jour les informations de sentiment et mots-clés dans la table restaurant."""
    RESTAURANT_TABLE.update_item(
        Key={'id': restaurant_id},
        UpdateExpression="SET average_feeling = :af, word_cloud = :wc",
        ExpressionAttributeValues={
            ':af': average_feeling,
            ':wc': word_cloud
        }
    )


def process_feelings():
    """Traite tous les restaurants nécessitant une analyse."""
    print('---------------------------------')
    print('Processing restaurants...')
    print('---------------------------------')

    restaurants = scan_restaurants()

    for restaurant in restaurants:
        restaurant_id = restaurant['id']
        print(f'Processing restaurant: {restaurant_id}')

        reviews_data = get_reviews_for_restaurant(restaurant_id)

        if reviews_data:
            reviews = [r["comment"] for r in reviews_data]
            review_ids = [r["id"] for r in reviews_data]

            response = handler({"reviews": reviews})  # On envoie un dict au handler
            response_body = json.loads(response["body"])

            if "error" not in response_body:
                average_feeling = response_body["average_feeling"]
                word_cloud = response_body["word_cloud"]
                reviews_with_feelings = response_body["reviews"]

                # Mettre à jour chaque avis avec son feeling
                for i, review in enumerate(reviews_with_feelings):
                    update_review(review_ids[i], review["feeling"])

                print(f'Updating restaurant {restaurant_id} - Feeling: {average_feeling}, Word Cloud: {word_cloud}')
                update_restaurant(restaurant_id, average_feeling, word_cloud)
            else:
                print(f'Error processing {restaurant_id}: {response_body["error"]}')
        else:
            print(f'No reviews found for restaurant: {restaurant_id}')

    return {
        'statusCode': 200,
        'body': json.dumps(f"Processed {len(restaurants)} restaurants.")
    }


if __name__ == "__main__":
    process_feelings()
