from neo4j import GraphDatabase
from concurrent.futures import ThreadPoolExecutor, as_completed
import os

uri = "neo4j+ssc://5830d6bf.databases.neo4j.io"
username = "5830d6bf"
password = "GPrI0zK7MaGw0uczDSPTjxCtef4LgMUJ4BM_6BUq4Ko"


class Neo4jUploader:
    def __init__(self, uri, username, password):
        self.driver = GraphDatabase.driver(uri, auth=(username, password))

    def close(self):
        self.driver.close()

    def upload_test(self, line_number, disease_name, test_name):
        with self.driver.session() as session:
            query = """
            MERGE (d:Disease {name: $disease_name})
            MERGE (t:Test {name: $test_name})
            MERGE (d)-[:DIAGNOSED_BY]->(t)
            """
            session.run(query, disease_name=disease_name, test_name=test_name)
        print(f"Line {line_number}: Added test '{test_name}' for disease '{disease_name}'")

    def upload_tests_from_file(self, file_path):
        if not os.path.exists(file_path):
            print(f"Error: File '{file_path}' not found.")
            return

        records = []
        with open(file_path, 'r') as file:
            for line_number, line in enumerate(file, 1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(" has test ")
                if len(parts) != 2:
                    print(f"Warning: Invalid format at line {line_number}: {line}")
                    continue
                records.append((line_number, parts[0], parts[1]))

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(self.upload_test, ln, disease, test): ln for ln, disease, test in records}
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"Error at line {futures[future]}: {e}")

    def run(self, file_path):
        try:
            self.upload_tests_from_file(file_path)
            print("Upload completed successfully.")
        except Exception as e:
            print(f"Error occurred: {e}")
        finally:
            self.close()


if __name__ == "__main__":
    uploader = Neo4jUploader(uri, username, password)
    uploader.run("../data/knowledge_tests.txt")