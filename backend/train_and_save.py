"""
Run this script LOCALLY (not on Vercel) to train the Random Forest
and save it as model.pkl. Commit model.pkl to your repo afterward.

Usage:
    cd backend
    python train_and_save.py
"""

import os
import pickle
import numpy as np
from dotenv import load_dotenv
from neo4j import GraphDatabase
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

load_dotenv()

NEO4J_URI      = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

print("[..] Connecting to Neo4j...")
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

def load_knowledge_base():
    with driver.session() as session:
        result = session.run("""
            MATCH (d:Disease)
            WITH d,
                 [(d)-[r:HAS_SYMPTOM]->(s:Symptom) |
                  {name: s.name, severity: r.weight, probability: r.probability}] AS symptoms,
                 [(d)-[:TREATED_BY]->(m:Medicine) |
                  {name: m.name, adult_dosage: m.adult_dosage,
                   child_dosage: m.child_dosage, elderly_dosage: m.elderly_dosage,
                   note: m.note}] AS medicines,
                 [(d)-[:DIAGNOSED_BY]->(t:Test) | t.name] AS tests
            RETURN d.name AS disease, symptoms, medicines, tests
        """)
        tables = {}
        for record in result:
            d = record["disease"]
            if not d:
                continue
            tables[d] = {"symptoms": {}, "medicines": [], "tests": record["tests"]}
            for s in record["symptoms"]:
                tables[d]["symptoms"][s["name"]] = {
                    "severity":    int(s["severity"]),
                    "probability": s["probability"] or 0.1
                }
            for m in record["medicines"]:
                tables[d]["medicines"].append({
                    "name":           m["name"],
                    "adult_dosage":   m["adult_dosage"]   or "N/A",
                    "child_dosage":   m["child_dosage"]   or "N/A",
                    "elderly_dosage": m["elderly_dosage"] or "N/A",
                    "note":           m["note"]           or "No notes"
                })
    return tables

def build_random_forest(tables):
    all_symptoms  = sorted({s for d in tables.values() for s in d["symptoms"]})
    symptom_index = {s: i for i, s in enumerate(all_symptoms)}
    disease_names = sorted(tables.keys())

    X_base = np.zeros((len(disease_names), len(all_symptoms)), dtype=float)
    for i, disease in enumerate(disease_names):
        for symptom, info in tables[disease]["symptoms"].items():
            X_base[i, symptom_index[symptom]] = info["severity"]

    rng = np.random.RandomState(42)
    X_out, y_out = [], []
    for i, disease in enumerate(disease_names):
        base = X_base[i]
        for _ in range(40):
            sample = base.copy()
            noise  = rng.normal(0, 0.3, size=base.shape)
            sample = np.where(base > 0, np.clip(sample + noise, 0, 3), 0)
            sample = sample * (rng.rand(len(base)) > 0.2)
            X_out.append(sample)
            y_out.append(i)

    X = np.array(X_out)
    y = np.array(y_out)

    le = LabelEncoder()
    le.fit(disease_names)

    rf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    rf.fit(X, y)
    print(f"[OK] Random Forest trained on {len(disease_names)} diseases, {len(all_symptoms)} symptoms")

    return rf, le, all_symptoms, symptom_index

print("[..] Loading knowledge base...")
TABLES = load_knowledge_base()
print(f"[OK] {len(TABLES)} diseases loaded")

print("[..] Training Random Forest...")
rf, le, all_symptoms, symptom_index = build_random_forest(TABLES)

bundle = {
    "tables":        TABLES,
    "rf":            rf,
    "label_enc":     le,
    "all_symptoms":  all_symptoms,
    "symptom_index": symptom_index,
}

out_path = os.path.join(os.path.dirname(__file__), "model.pkl")
with open(out_path, "wb") as f:
    pickle.dump(bundle, f)

print(f"[OK] Saved model.pkl ({os.path.getsize(out_path) / 1024 / 1024:.1f} MB)")
print("[DONE] Now commit model.pkl to your repo and push.")