from flask import Flask, render_template, request, jsonify, send_from_directory
import json
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Load flashcards from disk
with open("flashcards.json", "r", encoding="utf-8") as f:
    flashcards = json.load(f)

# Configure the assets folder (create it if it doesn't exist)
ASSETS_FOLDER = os.path.join(os.getcwd(), "assets")
if not os.path.exists(ASSETS_FOLDER):
    os.makedirs(ASSETS_FOLDER)
print(f"Assets Folder: {ASSETS_FOLDER}")
app.config["ASSETS_FOLDER"] = ASSETS_FOLDER

@app.route("/")
def index():
    # Pass the flashcards to the template as JSON
    return render_template("index.html", flashcards=flashcards)

@app.route("/assets/<filename>")
def serve_asset(filename):
    return send_from_directory(app.config["ASSETS_FOLDER"], filename)

@app.route("/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        return jsonify({"error": "No image part"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["ASSETS_FOLDER"], filename)
    file.save(filepath)
    # Return the URL relative to your assets folder.
    # You may need to configure static serving of the assets folder.
    return jsonify({"url": f"assets/{filename}"})

if __name__ == "__main__":
    app.run(debug=True)