import json
from analyse_feelings import analyse_feelings
from extract_words import extract_keywords
from collections import Counter
import boto3
from boto3.dynamodb.conditions import Attr

def handler(event, context):
    # Récupérer les commentaires sous forme de liste de chaînes
    reviews = json.loads(event)
    reviews = reviews.get("reviews", [])

    # Encoder en utf8
    reviews = [r.encode("utf-8") for r in reviews]


    if not isinstance(reviews, list) or not all(isinstance(r, str) for r in reviews):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid input format. Expected a list of strings."})
        }

    # Analyse des sentiments
    feelings = analyse_feelings(reviews)

    # Déterminer le sentiment dominant
    most_common_feeling = Counter(feelings).most_common(1)[0][0]

    # Extraire les mots-clés les plus importants
    word_cloud = extract_keywords(reviews, top_n=15)

    # Résultat final
    result = {
        "average_feeling": most_common_feeling,
        "word_cloud": word_cloud
    }

    return {
        "statusCode": 200,
        "body": json.dumps(result)
    }




session = boto3.Session(
    aws_access_key_id="",
    aws_secret_access_key="",
)

dynamodb = session.resource('dynamodb')

RESTAURANT_TABLE = dynamodb.Table('restaurants-elyes')
REVIEWS_TABLE = dynamodb.Table('reviews-elyes')


def scan_restaurants():
    table = dynamodb.Table(RESTAURANT_TABLE)
    response = table.scan(
        FilterExpression=Attr('average_feeling').not_exists() | Attr('word_cloud').not_exists()
    )
    return response.get('Items', [])

def get_reviews_for_restaurant(restaurant_id):
    table = dynamodb.Table(REVIEWS_TABLE)
    response = table.scan(
        FilterExpression=Attr('restaurant_id').eq(restaurant_id)
    )
    return [review['comment'] for review in response.get('Items', [])]

def update_restaurant(restaurant_id, average_feeling, word_cloud):
    table = dynamodb.Table(RESTAURANT_TABLE)
    table.update_item(
        Key={'id': restaurant_id},
        UpdateExpression="set average_feeling=:af, word_cloud=:wc",
        ExpressionAttributeValues={
            ':af': average_feeling,
            ':wc': word_cloud
        }
    )

def processFeelings(event, context):
    print('---------------------------------')
    print('Processing restaurants...')            
    print('---------------------------------')
    restaurants = scan_restaurants()

    for restaurant in restaurants:
        print('Processing restaurant:', restaurant['id'])
        restaurant_id = restaurant['id']
        reviews = get_reviews_for_restaurant(restaurant_id)
        
        if reviews:  
            print('---------------------------------')
            print('Reviews:', reviews)
            print('---------------------------------')
            average_feeling, word_cloud = handler(reviews)
            print('---------------------------------')
            print('Restaurant:', restaurant_id, 'Average feeling:', average_feeling, 'Word cloud:', word_cloud)
            print('---------------------------------')
            if average_feeling is not None and word_cloud is not None:
                update_restaurant(restaurant_id, average_feeling, word_cloud)
        else:
            print('No reviews found for restaurant:', restaurant_id)
            
    return {
        'statusCode': 200,
        'body': json.dumps(f"Processed {len(restaurants)} restaurants.")
    }

if __name__ == "__main__":
    processFeelings({}, {})

