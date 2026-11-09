import os

from flask import Flask, abort, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

import store

app = Flask(__name__)

# Deck lives in PERDISCO_DATA (database + flashcards.json export + assets/),
# or in src/ when unset (the demo deck shipped with the app).
store.init()
os.makedirs(store.assets_dir(), exist_ok=True)
LEGACY_ASSETS = os.path.join(store.SRC_DIR, "assets")
print(f"[perdisco] data: {store.data_dir()}")


@app.route("/")
def index():
    return render_template("index.html", flashcards=store.all_cards())


@app.route("/assets/<filename>")
def serve_asset(filename):
    # Uploads go to the data folder; fall back to images shipped in src/assets.
    for folder in (store.assets_dir(), LEGACY_ASSETS):
        if os.path.exists(os.path.join(folder, filename)):
            return send_from_directory(folder, filename)
    abort(404)


@app.route("/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        return jsonify({"error": "No image part"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    filename = secure_filename(file.filename) or "image.png"
    # Never overwrite an existing image: add a numeric suffix instead.
    base, ext = os.path.splitext(filename)
    n = 1
    while os.path.exists(os.path.join(store.assets_dir(), filename)):
        filename = f"{base}-{n}{ext}"
        n += 1
    file.save(os.path.join(store.assets_dir(), filename))
    return jsonify({"url": f"/assets/{filename}"})


# ---------- per-action API (each call is one small transaction) ----------

def _ok(result=True, status=200):
    if result is None or result is False:
        return jsonify({"success": False, "error": "card not found"}), 404
    return jsonify({"success": True, "card": result if isinstance(result, dict) else None}), status


@app.route("/api/cards", methods=["POST"])
def api_add_card():
    body = request.get_json(force=True)
    return _ok(store.add_card(body["card"], body.get("after_id")), 201)


@app.route("/api/cards/<int:card_id>", methods=["PATCH"])
def api_update_card(card_id):
    return _ok(store.update_card(card_id, request.get_json(force=True)))


@app.route("/api/cards/<int:card_id>", methods=["DELETE"])
def api_delete_card(card_id):
    return _ok(store.delete_card(card_id))


@app.route("/api/cards/<int:card_id>/move", methods=["POST"])
def api_move_card(card_id):
    return _ok(store.move_card(card_id, request.get_json(force=True).get("after_id")))


@app.route("/api/cards/<int:card_id>/attempts", methods=["POST"])
def api_add_attempt(card_id):
    a = request.get_json(force=True)
    return _ok(store.add_attempt(card_id, a["timestamp"], a["correct"], a.get("reason")), 201)


@app.route("/api/cards/<int:card_id>/attempts", methods=["DELETE"])
def api_clear_attempts(card_id):
    return _ok(store.clear_attempts(card_id))


@app.route("/api/cards/<int:card_id>/attempts/<int:timestamp>", methods=["DELETE"])
def api_delete_attempt(card_id, timestamp):
    return _ok(store.delete_attempt(card_id, timestamp))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PERDISCO_PORT", "8006")), debug=True)
