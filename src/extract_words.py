import stanza
import nltk
from nltk.corpus import stopwords
from collections import Counter
import re
from langdetect import detect
from deep_translator import GoogleTranslator

# Télécharger les stopwords français et anglais
nltk.download("stopwords")
stop_words_fr = set(stopwords.words("french"))
stop_words_en = set(stopwords.words("english"))

# Fusion des stopwords en français et en anglais
stop_words = stop_words_fr.union(stop_words_en)

# ajouter quelques mots à la liste des stopwords
stop_words.update(['être', 'très'])

# Charger les modèles NLP pour le français et l'anglais
nlp_fr = stanza.Pipeline(lang='fr', processors='tokenize,mwt,pos,lemma', verbose=False)
# tokenize: découpe le texte en mots
# mwt: traite les mots composés
# pos: identifie la catégorie grammaticale de chaque mot (ex: verbe, nom, adjectif)
# lemma: ramène chaque mot à sa forme canonique (ex: "mangé" -> "manger")


# Fonction pour détecter la langue et traduire si nécessaire
def detect_and_translate(text):
    try:
        lang = detect(text)  # Détecte la langue de l'avis
        if lang == "fr":
            return text  # Déjà en français, on ne traduit pas
        elif lang == "en":
            return GoogleTranslator(source='en', target='fr').translate(text)  # Traduction en français
        else:
            return None  # Si la langue n'est ni FR ni EN, on ignore l'avis
    except:
        return None  # Si la détection échoue, on ignore l'avis

# Fonction pour extraire les mots-clés
def extract_keywords(reviews, top_n=15):
    translated_reviews = [detect_and_translate(review) for review in reviews]
    translated_reviews = [review for review in translated_reviews if review]  # Supprimer les avis non traduits

    text = " ".join(translated_reviews).lower()
    text = re.sub(r'[^\w\s]', '', text)  # Supprime la ponctuation

    doc = nlp_fr(text)  # Analyse avec Stanza en français
    words = [word.lemma for sentence in doc.sentences for word in sentence.words if word.lemma not in stop_words]

    frequences = Counter(words)
    return frequences.most_common(top_n)
