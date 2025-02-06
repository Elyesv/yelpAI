# Projet Big Data - Analyse des Restaurants de Paris avec Yelp

## Description
Ce projet vise à récupérer les restaurants de Paris depuis Yelp, analyser les avis à l'aide d'un modèle d'intelligence artificielle pour déterminer le sentiment des clients, puis exposer ces données via une API. Une analyse visuelle est également disponible grâce à Amazon QuickSight.

## Fonctionnalités principales
1. **Récupération des données** : Extraction des restaurants de Paris depuis Yelp, incluant leurs avis.
2. **Analyse des sentiments** : Utilisation d'un modèle AI pour attribuer un score de sentiment aux avis.
3. **Enrichissement des données** : Ajout d'une colonne `feeling` aux reviews et calcul d'un `average feeling` pour chaque restaurant.
4. **Visualisation des tendances** : Génération d'un nuage de mots basé sur les avis.
5. **Exposition des données** : Création d'une API REST pour accéder aux restaurants et aux avis.
6. **Mise à jour automatisée** : Une Lambda AWS génère un manifest des données et alimente Amazon QuickSight.

## Architecture du projet
```
+---------------------------------------+
|       Extraction des Données          |
|       (Yelp API & Scrapping)                      |
+---------------------------------------+
                |
                v
+---------------------------------------+
|       Analyse des Sentiments          |
|       (Modèle AI)                     |
+---------------------------------------+
                |
                v
+---------------------------------------+
|       Stockage & Enrichissement       |
|       (Base de données)               |
+---------------------------------------+
                |
                v
+---------------------------------------+
|       API REST (AWS Lambda)           |
+---------------------------------------+
                |
                v
+---------------------------------------+
|       Visualisation (QuickSight)      |
+---------------------------------------+
```

## Documentation de l'API

### 1. Récupérer tous les restaurants
**Endpoint** : `GET /api/restaurants`

- **URL** : `https://zen5swbld0.execute-api.eu-west-1.amazonaws.com/api/restaurants`
- **Description** : Retourne la liste complète des restaurants avec leurs informations enrichies.
- **Exemple de réponse** :
```json
[
  {
    "id": "By-0jWy1qVMN_rsrcJRkIA",
    "name": "CopperBay",
    "address": "5 rue Bouchardon, 75010 Paris, France",
    "average_feeling": "neutre",
    "phone": "<empty>",
    "rating": 4.5,
    "url": "https://www.yelp.com/biz/copperbay-paris?adjust_creative=7MmwukaWnQhm5odunedORw&utm_campaign=yelp_api_v3&utm_medium=api_v3_business_search&utm_source=7MmwukaWnQhm5odunedORw",
    "word_cloud" : [ { "L" : [ { "S" : "avoir" }, { "N" : "23" } ] }, { "L" : [ { "S" : "bar" }, { "N" : "13" } ] }, { "L" : [ { "S" : "boisson" }, { "N" : "12" } ] }, { "L" : [ { "S" : "cocktail" }, { "N" : "11" } ] }, { "L" : [ { "S" : "endroit" }, { "N" : "9" } ] }, { "L" : [ { "S" : "si" }, { "N" : "8" } ] }, { "L" : [ { "S" : "tout" }, { "N" : "8" } ] }, { "L" : [ { "S" : "menu" }, { "N" : "6" } ] }, { "L" : [ { "S" : "plus" }, { "N" : "6" } ] }, { "L" : [ { "S" : "jadore" }, { "N" : "5" } ] }, { "L" : [ { "S" : "sympathique" }, { "N" : "5" } ] }, { "L" : [ { "S" : "rue" }, { "N" : "5" } ] }, { "L" : [ { "S" : "dun" }, { "N" : "5" } ] }, { "L" : [ { "S" : "cest" }, { "N" : "4" } ] }, { "L" : [ { "S" : "base" }, { "N" : "4" } ] } ],
  },
  ...
]
```

### 2. Récupérer les détails d’un restaurant sous forme de PDF
**Endpoint** : `GET /api/restaurant?id={restaurant_id}`

- **URL** : `https://zen5swbld0.execute-api.eu-west-1.amazonaws.com/api/restaurant?id=12345`
- **Description** : Retourne les informations détaillées d’un restaurant sous forme de PDF.
- **Paramètres** :
  - `restaurant_id` (obligatoire) : Identifiant du restaurant

### 3. Récupérer les avis d’un restaurant
**Endpoint** : `GET /api/reviews?id={restaurant_id}`

- **URL** : `https://zen5swbld0.execute-api.eu-west-1.amazonaws.com/api/reviews?id=12345`
- **Description** : Retourne les avis d’un restaurant spécifique avec leur score de sentiment.
- **Paramètres** :
  - `restaurant_id` (obligatoire) : Identifiant du restaurant
- **Exemple de réponse** :
```json
[
  {
    "review_id": "98765",
    "text": "Superbe expérience, la nourriture était incroyable!",
    "feeling": "positif"
  },
  {
    "review_id": "98765",
    "text": "Superbe expérience, la nourriture était incroyable!",
    "feeling": "positif"
  },
  ...
]
```

## Screenshots QuickSight

![Screenshot QuickSight](https://i.postimg.cc/7hsy3TfJ/Capture-d-e-cran-2025-02-06-a-15-45-50.png)

![Screenshot QuickSight](https://i.postimg.cc/tT908z6V/Capture-d-e-cran-2025-02-06-a-15-46-11.png)

---

## Déploiement et Automatisation
- **AWS Lambda** : Fonction Lambda exécutée en tâche cron pour récupérer et analyser les nouvelles données.
- **Manifest des données** : Génération automatique pour mise à jour de QuickSight.
- **Base de données** : Stockage des données enrichies pour une récupération efficace via l'API.

## Technologies utilisées
- **Yelp API** pour l'extraction des données
- **Modèle AI** pour l'analyse des sentiments
- **AWS Lambda** pour l’automatisation
- **Amazon QuickSight** pour la visualisation
- **API Gateway** pour l’exposition des endpoints

## Auteurs
- Elyes VOISIN
- Adel KHITER
- Augustin BRIOLON

## Licence
Ce projet est sous licence MIT.
