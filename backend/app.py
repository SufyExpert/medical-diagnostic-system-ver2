from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
import re
import math
import bcrypt
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

app = Flask(__name__)
CORS(app, origins="*")

# ─── GLOBAL ERROR HANDLER ───────────────────────────────────────────
# Ensures ALL unhandled exceptions return {"error": "string"} so the
# React frontend never receives an object it can't render.
@app.errorhandler(Exception)
def handle_exception(e):
    import traceback
    traceback.print_exc()
    code = getattr(e, 'code', 500)
    return jsonify({"error": str(e)}), code



# ─── MONGODB ────────────────────────────────────────────────────────

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME   = os.getenv("DB_NAME", "medical_diagnostic")

if not MONGO_URI:
    print("[WARNING] MONGO_URI not found — MongoDB features will be unavailable")
    client = None
else:
    client = MongoClient(MONGO_URI)
    try:
        client.admin.command('ping')
        print("[OK] MongoDB connected")
    except Exception as e:
        print("[ERROR] MongoDB connection error:", e)

db                = client[DB_NAME] if client else None
users_collection  = db["users"] if db is not None else None

# ─── NEO4J ──────────────────────────────────────────────────────────

NEO4J_URI      = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

if not NEO4J_URI:
    print("[WARNING] NEO4J_URI not found — diagnosis features will be unavailable")
    neo4j_driver = None
else:
    neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

# ─── LOAD MODEL FROM PICKLE (pre-trained locally, committed to repo) ─
# To regenerate: run train_and_save.py locally, then commit model.pkl

import pickle
import numpy as np

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

try:
    with open(_MODEL_PATH, "rb") as f:
        _bundle = pickle.load(f)
    TABLES       = _bundle["tables"]
    RF_MODEL     = _bundle["rf"]
    LABEL_ENC    = _bundle["label_enc"]
    ALL_SYMPTOMS = _bundle["all_symptoms"]
    SYMPTOM_IDX  = _bundle["symptom_index"]
    print(f"[OK] Loaded model.pkl — {len(TABLES)} diseases, {len(ALL_SYMPTOMS)} symptoms")
except Exception as e:
    print(f"[ERROR] Could not load model.pkl: {e}")
    TABLES, RF_MODEL, LABEL_ENC, ALL_SYMPTOMS, SYMPTOM_IDX = {}, None, None, [], {}

# ─── HELPER: RF INFERENCE ───────────────────────────────────────────

def rf_infer(symptoms_input, top_n=4):
    """
    symptoms_input: list of {"name": str, "severity": int}
    Returns top_n disease names ranked by RF probability.
    """
    if RF_MODEL is None:
        return []

    vec = np.zeros(len(ALL_SYMPTOMS), dtype=float)
    for s in symptoms_input:
        idx = SYMPTOM_IDX.get(s["name"])
        if idx is not None:
            vec[idx] = s["severity"]

    probs   = RF_MODEL.predict_proba([vec])[0]
    top_idx = np.argsort(probs)[::-1][:top_n]
    return [LABEL_ENC.classes_[i] for i in top_idx]



# ─── AUTH ROUTES ────────────────────────────────────────────────────

@app.route("/api/signup", methods=["POST"])
def signup():
    if users_collection is None:
        return jsonify({"error": "Database connection not available. Please verify MONGO_URI in Vercel settings."}), 503
    data      = request.json
    username  = data.get("username",  "").strip()
    password  = data.get("password",  "")
    full_name = data.get("full_name", "").strip()
    dob       = data.get("dob",       "").strip()
    contact   = data.get("contact",   "").strip()

    if not all([username, password, full_name, dob, contact]):
        return jsonify({"error": "All fields are required."}), 400
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({"error": "Username must contain only letters, numbers, underscores."}), 400
    if not re.match(r'^[a-zA-Z\s]+$', full_name):
        return jsonify({"error": "Full name must contain only letters and spaces."}), 400
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', dob):
        return jsonify({"error": "DOB must be YYYY-MM-DD."}), 400
    if not re.match(r'^\d{11}$', contact):
        return jsonify({"error": "Contact must be 11 digits."}), 400

    try:
        birth_date = datetime.strptime(dob, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date."}), 400

    try:
        if users_collection.find_one({"username": username}):
            return jsonify({"error": "Username already exists."}), 409

        today = datetime.today()
        age   = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        hashed_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        users_collection.insert_one({
            "username":   username,
            "password":   hashed_pw,
            "full_name":  full_name,
            "dob":        dob,
            "contact":    contact,
            "age":        age,
            "diseases":   [],
            "created_at": datetime.utcnow()
        })
        return jsonify({"message": "Account created successfully."}), 201
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/api/signin", methods=["POST"])
def signin():
    if users_collection is None:
        return jsonify({"error": "Database connection not available. Please verify MONGO_URI in Vercel settings."}), 503
    data     = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password required."}), 400

    try:
        user = users_collection.find_one({"username": username})
        if not user or not bcrypt.checkpw(password.encode(), user["password"].encode()):
            return jsonify({"error": "Invalid credentials."}), 401

        return jsonify({
            "message": "Signed in successfully.",
            "user": {
                "username":  user["username"],
                "full_name": user["full_name"],
                "dob":       user["dob"],
                "contact":   user["contact"],
                "age":       user["age"],
                "diseases":  user.get("diseases", [])
            }
        }), 200
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

# ─── PROFILE ROUTES ─────────────────────────────────────────────────

@app.route("/api/profile/<username>", methods=["GET"])
def get_profile(username):
    if users_collection is None:
        return jsonify({"error": "Database connection not available. Please verify MONGO_URI in Vercel settings."}), 503
    user = users_collection.find_one({"username": username}, {"_id": 0, "password": 0})
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify(user), 200


@app.route("/api/profile/<username>/disease", methods=["POST"])
def add_disease(username):
    if users_collection is None:
        return jsonify({"error": "Database connection not available. Please verify MONGO_URI in Vercel settings."}), 503
    disease = request.json.get("disease")
    if not disease:
        return jsonify({"error": "Disease required."}), 400
    users_collection.update_one(
        {"username": username},
        {"$push": {"diseases": {"name": disease, "cured": False, "added_at": datetime.utcnow().isoformat()}}}
    )
    return jsonify({"message": "Disease added."}), 200


@app.route("/api/profile/<username>/disease/cure", methods=["PUT"])
def cure_disease(username):
    if users_collection is None:
        return jsonify({"error": "Database connection not available. Please verify MONGO_URI in Vercel settings."}), 503
    disease = request.json.get("disease")
    users_collection.update_one(
        {"username": username, "diseases.name": disease},
        {"$set": {"diseases.$.cured": True}}
    )
    return jsonify({"message": "Marked as cured."}), 200


@app.route("/api/profile/<username>/disease", methods=["DELETE"])
def delete_disease(username):
    if users_collection is None:
        return jsonify({"error": "Database connection not available. Please verify MONGO_URI in Vercel settings."}), 503
    disease = request.json.get("disease")
    users_collection.update_one(
        {"username": username},
        {"$pull": {"diseases": {"name": disease}}}
    )
    return jsonify({"message": "Disease deleted."}), 200

# ─── SYMPTOM ROUTES ─────────────────────────────────────────────────

@app.route("/api/symptoms", methods=["GET"])
def get_symptoms():
    if neo4j_driver is None:
        return jsonify({"error": "Neo4j database connection not available. Please verify NEO4J_URI in Vercel settings."}), 503
    with neo4j_driver.session() as session:
        result   = session.run("MATCH (s:Symptom) RETURN s.name AS name ORDER BY s.name")
        symptoms = [r["name"] for r in result]
    return jsonify(symptoms), 200

# ─── DIAGNOSIS: STEP 1 ──────────────────────────────────────────────
# Takes 2 symptoms → returns top 4 diseases + relevant additional symptoms

@app.route("/api/diagnose/step1", methods=["POST"])
def diagnose_step1():
    if RF_MODEL is None or not TABLES:
        return jsonify({"error": "Knowledge base or ML model not loaded. Please verify NEO4J connection settings in Vercel."}), 503
    data           = request.json
    symptoms_input = data.get("symptoms", [])   # [{"name":..., "severity":...}]

    # Get top 4 diseases via Random Forest
    top4 = rf_infer(symptoms_input, top_n=4)

    # Collect additional relevant symptoms from these 4 diseases
    # (exclude symptoms already provided by user)
    used_symptoms = {s["name"] for s in symptoms_input}
    relevant      = {}

    for disease in top4:
        for symptom in TABLES[disease]["symptoms"]:
            if symptom not in used_symptoms:
                relevant[symptom] = relevant.get(symptom, 0) + 1

    # Sort by how many of the top-4 diseases share this symptom (most discriminating first)
    additional_symptoms = sorted(relevant, key=lambda s: relevant[s], reverse=True)[:8]

    return jsonify({
        "top4":                top4,
        "additional_symptoms": additional_symptoms
    }), 200


# ─── DIAGNOSIS: STEP 2 ──────────────────────────────────────────────
# Takes all symptoms (original + additional selected) → finalizes 1 disease

@app.route("/api/diagnose/step2", methods=["POST"])
def diagnose_step2():
    if RF_MODEL is None or not TABLES:
        return jsonify({"error": "Knowledge base or ML model not loaded. Please verify NEO4J connection settings in Vercel."}), 503
    data           = request.json
    symptoms_input = data.get("symptoms", [])   # all symptoms combined
    top4           = data.get("top4",     [])   # the 4 from step 1

    # Run RF again on full symptom set, but only among top4 candidates
    vec = np.zeros(len(ALL_SYMPTOMS), dtype=float)
    for s in symptoms_input:
        idx = SYMPTOM_IDX.get(s["name"])
        if idx is not None:
            vec[idx] = s["severity"]

    probs       = RF_MODEL.predict_proba([vec])[0]
    # Filter only top4 candidates
    top4_scores = {}
    for disease in top4:
        if disease in LABEL_ENC.classes_:
            i = list(LABEL_ENC.classes_).index(disease)
            top4_scores[disease] = probs[i]

    final_disease = max(top4_scores, key=top4_scores.get) if top4_scores else top4[0]
    info          = TABLES[final_disease]

    return jsonify({
        "disease":  final_disease,
        "medicines": info["medicines"],
        "tests":     info["tests"]
    }), 200


@app.route("/api/disease/<disease_name>", methods=["GET"])
def get_disease_detail(disease_name):
    """Return medicines and tests for a specific disease (used by Profile detail modal)."""
    if not TABLES:
        return jsonify({"error": "Knowledge base not loaded. Please verify NEO4J connection settings in Vercel."}), 503
    info = TABLES.get(disease_name)
    if not info:
        return jsonify({"error": "Disease not found"}), 404
    return jsonify({
        "disease":   disease_name,
        "medicines": info["medicines"],
        "tests":     info["tests"],
    }), 200


# ─── RUN ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)