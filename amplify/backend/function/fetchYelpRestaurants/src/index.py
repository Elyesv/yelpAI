import json
import boto3
import requests
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table_name = os.environ['STORAGE_RESTAURANTS_NAME']  
table = dynamodb.Table(table_name)

YELP_API_KEY = os.environ['YELP_API_KEY']  
YELP_API_URL = "https://api.yelp.com/v3/businesses/search"


def restaurant_exists(business_id):
    try:
        response = table.get_item(Key={"id": business_id})  
        return "Item" in response
    except Exception as e:
        print(f"Erreur DynamoDB: {e}")
        return False

def handler(event, context):
    location = event.get("location", "France") 
    
    headers = {
        "Authorization": f"Bearer {YELP_API_KEY}",
        "Content-Type": "application/json"
    }
    
    all_restaurants = []
    offset = 0  
    limit = 50  
    
    while True:
        params = {
            "location": location,
            "categories": "restaurants",
            "limit": limit,
            "offset": offset
        }
        
        response = requests.get(YELP_API_URL, headers=headers, params=params)
        data = response.json()
        
        if "businesses" not in data or not data["businesses"]:
            break  
        
        for business in data["businesses"]:
            if not restaurant_exists(business["id"]):
                item = {
                    "id": business["id"], 
                    "name": business["name"],
                    "rating": Decimal(str(business.get("rating", 0))),
                    "address": ", ".join(business["location"]["display_address"]),
                    "phone": business.get("display_phone", "N/A"),
                    "url": business["url"]
                }
                table.put_item(Item=item)
                all_restaurants.append(item)
        
        offset += limit  
    
    return {
        "statusCode": 200,
        "body": json.dumps(f"{len(all_restaurants)} nouveaux restaurants ajoutes dans DynamoDB")
    }