# Image officielle AWS pour AWS Lambda avec Python 3.13
FROM public.ecr.aws/lambda/python:3.13

# Définir le répertoire de travail
WORKDIR /var/task

RUN pwd

# Copier les fichiers nécessaires
COPY main.py ./
COPY ../requirements.txt ./


# Installer les dépendances
RUN pip install -r requirements.txt

# Définir le point d'entrée pour AWS Lambda
CMD ["main.handler"]
