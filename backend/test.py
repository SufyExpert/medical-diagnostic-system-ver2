from pymongo import MongoClient

# Directly use your URI (or store it in env variable properly)
MONGO_URI = "mongodb+srv://sufyexpert:sufysufysufy@cluster0.jtbdpmp.mongodb.net/?appName=Cluster0"

try:
    client = MongoClient(MONGO_URI)

    # This forces a connection attempt
    client.admin.command('ping')

    print("✅ Connected to MongoDB successfully!")

    # Access database
    db = client["medical_diagnostic"]

    # List collections (just to confirm access)
    print("Collections:", db.list_collection_names())

except Exception as e:
    print("❌ Connection failed:")
    print(e)