import json
import pandas as pd
from analyse_feelings import analyse_feelings
from extract_words import extract_keywords
from collections import Counter

def handler(event, context):
    # Récupérer les commentaires sous forme de liste de chaînes
    reviews = json.loads(event)
    reviews = reviews.get("reviews", [])

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

# ---- TEST LOCAL ----
if __name__ == "__main__":
    fake_event = {
        "reviews": [
            "J'adore cet endroit, le service est parfait !",
            "Plats très moyens, et service un peu lent...",
            "Excellente expérience, je recommande fortement !",
            "Horrible, je ne reviendrai jamais !",
            "Le personnel était adorable et très attentionné.",
            "Service rapide, mais la nourriture était fade.",
            "Food was amazing, I’ll definitely come back!",
            "Terrible experience, the waiter was rude.",
            "Best restaurant in town, highly recommended!",
            "Pas mal, mais pas exceptionnel non plus.",
            "Très cher pour la qualité proposée.",
            "A great place to dine, the ambiance is wonderful!",
            "Average food, nothing special.",
            "J'ai adoré l'atmosphère, mais les plats étaient trop salés.",
            "Great service but the food was just okay."
        ]
    }

    response = handler(json.dumps(fake_event), None)
    print(json.loads(response["body"]))
