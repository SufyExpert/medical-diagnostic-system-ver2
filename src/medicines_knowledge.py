from neo4j import GraphDatabase
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
from dotenv import load_dotenv

# Load credentials from backend/.env if present
dotenv_path = os.path.join(os.path.dirname(__file__), '../backend/.env')
load_dotenv(dotenv_path)

class Neo4jMedicineLoader:
    def __init__(self, uri, user, password):
        """Initialize Neo4j driver."""
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        """Close Neo4j driver connection."""
        self.driver.close()

    def add_medicine(self, disease_name, medicine_name, adult_dosage, child_dosage, elderly_dosage, note):
        """Add Medicine node and TREATED_BY relationship for a disease."""
        with self.driver.session() as session:
            session.execute_write(self._create_medicine_and_relationship,
                                  disease_name, medicine_name, adult_dosage, child_dosage, elderly_dosage, note)

    @staticmethod
    def _create_medicine_and_relationship(tx, disease_name, medicine_name, adult_dosage, child_dosage, elderly_dosage, note):
        """Execute Cypher query to create Medicine node and TREATED_BY relationship."""
        query = (
            "MATCH (d:Disease {name: $disease_name}) "
            "MERGE (m:Medicine {name: $medicine_name}) "
            "SET m.adult_dosage = $adult_dosage, "
            "    m.child_dosage = $child_dosage, "
            "    m.elderly_dosage = $elderly_dosage, "
            "    m.note = $note "
            "MERGE (d)-[:TREATED_BY]->(m)"
        )
        tx.run(query, disease_name=disease_name, medicine_name=medicine_name,
               adult_dosage=adult_dosage, child_dosage=child_dosage,
               elderly_dosage=elderly_dosage, note=note)

def parse_knowledge_file(file_path):
    """Parse the knowledge_medicines.txt file and return a list of disease-medicine data."""
    data = []
    current_disease = None
    current_medicines = []
    current_adult_dosage = None
    current_child_dosage = None
    current_elderly_dosage = None
    current_note = ""
    in_dosage = False

    try:
        with open(file_path, 'r') as file:
            for line in file:
                line = line.strip()

                if not line:
                    if current_disease and current_medicines:
                        for medicine in current_medicines:
                            data.append({
                                'disease': current_disease,
                                'medicine': medicine,
                                'adult_dosage': current_adult_dosage if current_adult_dosage != "Not applicable" else None,
                                'child_dosage': current_child_dosage if current_child_dosage != "Not applicable" else None,
                                'elderly_dosage': current_elderly_dosage if current_elderly_dosage != "Not applicable" else None,
                                'note': current_note if current_note else None
                            })
                    current_disease = None
                    current_medicines = []
                    current_adult_dosage = None
                    current_child_dosage = None
                    current_elderly_dosage = None
                    current_note = ""
                    in_dosage = False
                    continue

                if line.startswith("Disease:"):
                    current_disease = line.replace("Disease: ", "")
                elif line.startswith("Medicines:"):
                    current_medicines = [med.strip() for med in line.replace("Medicines: ", "").split(",")]
                elif line.startswith("Dosage:"):
                    in_dosage = True
                elif in_dosage and line.startswith("- Adults:"):
                    current_adult_dosage = line.replace("- Adults: ", "")
                elif in_dosage and line.startswith("- Children:"):
                    current_child_dosage = line.replace("- Children: ", "")
                elif in_dosage and line.startswith("- Elderly:"):
                    current_elderly_dosage = line.replace("- Elderly: ", "")
                elif line.startswith("Note:"):
                    current_note = line.replace("Note: ", "")

            if current_disease and current_medicines:
                for medicine in current_medicines:
                    data.append({
                        'disease': current_disease,
                        'medicine': medicine,
                        'adult_dosage': current_adult_dosage if current_adult_dosage != "Not applicable" else None,
                        'child_dosage': current_child_dosage if current_child_dosage != "Not applicable" else None,
                        'elderly_dosage': current_elderly_dosage if current_elderly_dosage != "Not applicable" else None,
                        'note': current_note if current_note else None
                    })
        return data

    except FileNotFoundError:
        print(f"Error: File {file_path} not found.")
        return []
    except Exception as e:
        print(f"Error parsing file: {e}")
        return []

def main():
    uri = os.getenv("NEO4J_URI", "neo4j+ssc://673dc2cb.databases.neo4j.io")
    if uri.startswith("neo4j+s://"):
        uri = uri.replace("neo4j+s://", "neo4j+ssc://")

    user = os.getenv("NEO4J_USERNAME", "673dc2cb")
    password = os.getenv("NEO4J_PASSWORD", "PkWvQnvT-rrp5TQ_ZiM73Ht-w4prxOc6P9lGZ4Induk")
    file_path = os.path.join(os.path.dirname(__file__), "../data/knowledge_medicines.txt")

    try:
        loader = Neo4jMedicineLoader(uri, user, password)
    except Exception as e:
        print(f"Error connecting to Neo4j: {e}")
        return

    medicines_data = parse_knowledge_file(file_path)
    if not medicines_data:
        print("No data to process.")
        loader.close()
        return

    def upload_entry(entry):
        print(f"Processing: Disease={entry['disease']}, Medicine={entry['medicine']}")
        loader.add_medicine(
            entry['disease'],
            entry['medicine'],
            entry['adult_dosage'],
            entry['child_dosage'],
            entry['elderly_dosage'],
            entry['note']
        )

    try:
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(upload_entry, entry): entry for entry in medicines_data}
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"Error processing entry: {e}")
        print("Successfully added all medicines and relationships.")
    except Exception as e:
        print(f"Error adding medicines to Neo4j: {e}")
    finally:
        loader.close()

if __name__ == "__main__":
    main()