# Image officielle AWS pour AWS Lambda avec Python 3.8
FROM public.ecr.aws/lambda/python:3.13

# Copier les fichiers nécessaires
COPY main.py requirements.txt ./

# Installer les dépendances
RUN pip install -r requirements.txt

# Définir le point d'entrée pour AWS Lambda
CMD ["main.handler"]