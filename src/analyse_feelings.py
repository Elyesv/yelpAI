from transformers import pipeline

feeling_model = pipeline("sentiment-analysis", model="nlptown/bert-base-multilingual-uncased-sentiment")
# on prend le model multilingue car les avis peuvent être en plusieurs langues

def analyse_feelings(avis):
    resultats = feeling_model(avis)
    # renvoie un tableau d'objets de la forme {'label': '1 star', 'score': 0.9997}
    # moins il y a de stars, plus le sentiment est négatif
    # le score est la probabilité que le sentiment soit correct
    sentiments = []

    for resultat in resultats:
        score = int(resultat['label'][0])
        if score <= 2:
            sentiments.append("négatif")
        elif score == 3:
            sentiments.append("neutre")
        else:
            sentiments.append("positif")

    return sentiments
