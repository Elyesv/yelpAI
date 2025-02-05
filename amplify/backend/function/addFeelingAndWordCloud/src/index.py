import boto3
import json
import os
from boto3.dynamodb.conditions import Attr


dynamodb = boto3.resource('dynamodb')
lambda_client = boto3.client('lambda')

RESTAURANT_TABLE = os.environ['STORAGE_RESTAURANTS_NAME']
REVIEWS_TABLE = os.environ['STORAGE_REVIEWS_NAME']


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

def invoke_huggingface_lambda(reviews):
    response = lambda_client.invoke(
        FunctionName="ServerlessHuggingFaceStack-main7AD10839-RRfiP2uoNupj",
        InvocationType='RequestResponse',
        Payload=json.dumps({'reviews': reviews})
    )
    print("---------------------------------")
    print("Valeur d'entré", json.dumps({'reviews': reviews}))
    print("---------------------------------")
    result = json.loads(response['Payload'].read())
    print('Huggingface result:', result)
    return result.get('average_feeling'), result.get('word_cloud')

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

def handler(event, context):
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
            average_feeling, word_cloud = invoke_huggingface_lambda(reviews)
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
