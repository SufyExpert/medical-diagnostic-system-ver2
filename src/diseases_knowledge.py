from neo4j import GraphDatabase
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
from dotenv import load_dotenv

# Load credentials from backend/.env if present
dotenv_path = os.path.join(os.path.dirname(__file__), '../backend/.env')
load_dotenv(dotenv_path)

uri = os.getenv("NEO4J_URI", "neo4j+ssc://673dc2cb.databases.neo4j.io")
# Always ensure we use +ssc locally if neo4j+s is provided to avoid SSL handshake issues
if uri.startswith("neo4j+s://"):
    uri = uri.replace("neo4j+s://", "neo4j+ssc://")

username = os.getenv("NEO4J_USERNAME", "673dc2cb")
password = os.getenv("NEO4J_PASSWORD", "PkWvQnvT-rrp5TQ_ZiM73Ht-w4prxOc6P9lGZ4Induk")
driver = GraphDatabase.driver(uri, auth=(username, password))

def create_disease_nodes_and_relationships(tx, disease, symptom_weights_probs):
    tx.run("MERGE (d:Disease {name: $name})", name=disease)
    for symptom, weight, prob in symptom_weights_probs:
        tx.run("MERGE (s:Symptom {name: $name})", name=symptom)
        tx.run(
            "MATCH (d:Disease {name: $disease}), (s:Symptom {name: $symptom}) "
            "MERGE (d)-[r:HAS_SYMPTOM]->(s) "
            "SET r.weight = $weight, r.probability = $prob",
            disease=disease, symptom=symptom, weight=weight, prob=prob
        )

def process_disease(disease, symptom_weights_probs):
    with driver.session() as session:
        session.write_transaction(create_disease_nodes_and_relationships, disease, symptom_weights_probs)
    print(f"Processed: {disease}")

def process_knowledge_file(file_path):
    try:
        with open(file_path, 'r') as file:
            knowledge = file.readlines()

        data = []
        for sentence in knowledge:
            sentence = sentence.strip()
            if sentence:
                parts = sentence.split(" has symptoms ")
                if len(parts) == 2:
                    disease = parts[0].strip()
                    symptoms_part = parts[1].rstrip('.')
                    symptom_weight_prob_pairs = [pair.strip() for pair in symptoms_part.split(',')]
                    symptoms = []
                    for pair in symptom_weight_prob_pairs:
                        subparts = pair.split(':')
                        if len(subparts) == 3:
                            symptom = subparts[0].strip()
                            try:
                                weight = float(subparts[1].strip())
                                prob = float(subparts[2].strip())
                                symptoms.append((symptom, weight, prob))
                            except ValueError:
                                print(f"Skipping invalid weight or probability for symptom '{symptom}' in disease '{disease}'")
                        else:
                            print(f"Skipping invalid pair '{pair}' for disease '{disease}'")
                    data.append((disease, symptoms))

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(process_disease, disease, symptoms): disease for disease, symptoms in data}
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"Error processing {futures[future]}: {e}")

        print("Successfully processed all diseases and symptoms.")
    except Exception as e:
        print(f"Error processing file: {str(e)}")
    finally:
        driver.close()

try:
    with driver.session() as session:
        session.run("MATCH (n) RETURN n LIMIT 1")
    print("Connected successfully")
    data_path = os.path.join(os.path.dirname(__file__), "../data/knowledge.txt")
    process_knowledge_file(data_path)
except Exception as e:
    print("Connection failed:", str(e))