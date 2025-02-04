import json
import boto3
import uuid
import os
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from datetime import datetime
from selenium import webdriver

dynamodb = boto3.resource('dynamodb')
restaurants_table = dynamodb.Table(os.environ['STORAGE_RESTAURANTS_NAME'])
reviews_table = dynamodb.Table(os.environ['STORAGE_REVIEWS_NAME'])

def get_restaurants():
    response = restaurants_table.scan()
    return response.get('Items', [])

def scrape_reviews(url):
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get(url)
    
    reviews = []
    wait = WebDriverWait(driver, 10)

    while True:
        try:
            # Attente explicite pour s'assurer que les avis sont chargés
            review_elements = wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, 'comment__09f24__D0cxf')))
            
            for element in review_elements:
                try:
                    # Attente de la note avec un fallback pour éviter les erreurs
                    rating_element = WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.CLASS_NAME, 'y-css-dnttlc'))
                    )
                    rating = rating_element.get_attribute("aria-label").split(" ")[0] if rating_element else "0"
                    print("Rating: ", rating)
                except:
                    rating = "0"  # Si aucun élément trouvé, on met 0
                
                try:
                    # Récupération du commentaire sans les balises HTML
                    comment_element = element.find_element(By.CLASS_NAME, "raw__09f24__T4Ezm")
                    comment = comment_element.text.strip()
                    print("Comment: ", comment)
                except:
                    comment = ""
                
                if comment:  # Ne stocker que les commentaires non vides
                    reviews.append({"rating": int(rating), "comment": comment})
            
            # Vérification de la pagination
            next_page = driver.find_elements(By.CLASS_NAME, 'next-link')
            if next_page:
                next_page[0].click()
                WebDriverWait(driver, 5).until(EC.staleness_of(review_elements))  # Attendre que la page se recharge
            else:
                break
        except Exception as e:
            print(f"Error while scraping: {e}")
            break

    driver.quit()
    return reviews

def insert_reviews(reviews):
    with reviews_table.batch_writer() as batch:
        for review in reviews:
            batch.put_item(Item=review)
 
def handler(event, context):
    try:
        restaurants = get_restaurants()
        all_reviews = []
        
        for restaurant in restaurants:
            restaurant_id = restaurant['id']
            url = restaurant.get('url')
            if not url:
                continue
            
            reviews = scrape_reviews(url)
            formatted_reviews = [{
                'id': str(uuid.uuid4()),
                'restaurant_id': restaurant_id,
                'rating': review['rating'],
                'comment': review['comment'],
            } for review in reviews if review['comment']]
            
            insert_reviews(formatted_reviews)
            all_reviews.extend(formatted_reviews)
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Reviews added successfully', 'reviews': all_reviews})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
