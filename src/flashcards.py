from flask import Flask, render_template
import json
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Load flashcards from disk
with open("flashcards.json", "r", encoding="utf-8") as f:
    flashcards = json.load(f)

@app.route("/")
def index():
    # Pass the flashcards to the template as JSON
    return render_template("index.html", flashcards=flashcards)

if __name__ == "__main__":
    app.run(debug=True)