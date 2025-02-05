import json
import pandas as pd
from inference.analyse_feelings import analyse_feelings
from inference.extract_words import extract_keywords
from collections import Counter

def handler(event, context):
    # Simuler les avis provenant d'une DB
    reviews = event.get("reviews", [])

    # Analyse des sentiments pour chaque avis
    for review in reviews:
        review["feeling"] = analyse_feelings([review["comment"]])[0]

    # Grouper par restaurant_id
    restaurants = {}
    for review in reviews:
        rest_id = review["restaurant_id"]
        if rest_id not in restaurants:
            restaurants[rest_id] = {"comments": [], "feelings": []}
        restaurants[rest_id]["comments"].append(review["comment"])
        restaurants[rest_id]["feelings"].append(review["feeling"])

    # Résultats finaux pour chaque restaurant
    restaurant_results = []
    for rest_id, data in restaurants.items():
        most_common_feeling = Counter(data["feelings"]).most_common(1)[0][0]
        word_cloud = extract_keywords(data["comments"], top_n=15)
        restaurant_results.append({
            "restaurant_id": rest_id,
            "average_feeling": most_common_feeling,
            "word_cloud": word_cloud
        })

    return {
        "statusCode": 200,
        "body": json.dumps(restaurant_results)
    }
