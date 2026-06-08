"""
Vercel Python Serverless Entry Point
-------------------------------------
This file is the single serverless function that Vercel invokes for every
/api/* request. It adds the backend/ directory to sys.path so that the
Flask app defined in backend/app.py is importable, then re-exports the
WSGI `app` object which Vercel's @vercel/python runtime calls directly.
"""
import sys
import os

# Make the backend package importable from this file's location
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_dir))

# Import the Flask app — all routes and startup logic run at import time
from app import app  # noqa: E402, F401

# Vercel looks for a module-level `app` variable that is a WSGI callable
# The import above already provides it; nothing else is needed.
