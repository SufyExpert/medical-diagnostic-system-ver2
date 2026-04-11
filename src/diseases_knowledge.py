from neo4j import GraphDatabase
from concurrent.futures import ThreadPoolExecutor, as_completed

uri = "neo4j+ssc://5830d6bf.databases.neo4j.io"
username = "5830d6bf"
password = "GPrI0zK7MaGw0uczDSPTjxCtef4LgMUJ4BM_6BUq4Ko"
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
    process_knowledge_file("../data/knowledge.txt")
except Exception as e:
    print("Connection failed:", str(e))