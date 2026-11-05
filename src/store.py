"""SQLite storage for the Perdisco deck.

The database is the live source of truth. `flashcards.json` next to it is a
deterministic text export for git: written by `export_json()` (see
tools/snapshot.sh) and used to rebuild the database when it is missing.

Command line:
    python3 store.py export   # write <data>/flashcards.json from the database
    python3 store.py import   # rebuild the database from <data>/flashcards.json
"""
import json
import os
import sqlite3
import sys
import time
from contextlib import contextmanager

SRC_DIR = os.path.dirname(os.path.abspath(__file__))

SCHEMA = """
CREATE TABLE IF NOT EXISTS cards (
  id                  INTEGER PRIMARY KEY,
  position            INTEGER NOT NULL,
  front               TEXT    NOT NULL DEFAULT '',
  back                TEXT    NOT NULL DEFAULT '',
  absolutely_required INTEGER NOT NULL DEFAULT 0,
  extra               TEXT    NOT NULL DEFAULT '{}',  -- other card fields (understanding, importance, ...)
  updated_at          INTEGER
);
CREATE INDEX IF NOT EXISTS cards_position ON cards(position);
CREATE TABLE IF NOT EXISTS tags (
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  ord     INTEGER NOT NULL,
  tag     TEXT    NOT NULL,
  PRIMARY KEY (card_id, ord)
);
CREATE TABLE IF NOT EXISTS attempts (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  ts      INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  reason  TEXT
);
CREATE INDEX IF NOT EXISTS attempts_card ON attempts(card_id, ts);
"""

CORE_FIELDS = {"id", "front", "back", "tags", "absolutelyRequired", "attempts"}


def data_dir():
    """PERDISCO_DATA if set, else src/ (the demo deck shipped with the app)."""
    return os.path.abspath(os.path.expanduser(os.environ.get("PERDISCO_DATA") or SRC_DIR))


def db_path():
    return os.path.join(data_dir(), "perdisco.db")


def json_path():
    return os.path.join(data_dir(), "flashcards.json")


def assets_dir():
    return os.path.join(data_dir(), "assets")


def now_ms():
    return int(time.time() * 1000)


@contextmanager
def connect():
    conn = sqlite3.connect(db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init():
    """Create the database, importing flashcards.json if the database is new."""
    os.makedirs(data_dir(), exist_ok=True)
    fresh = not os.path.exists(db_path())
    with connect() as conn:
        conn.executescript(SCHEMA)
    if fresh and os.path.exists(json_path()):
        with open(json_path(), encoding="utf-8") as f:
            import_cards(json.load(f))


# ---------- import / export ----------

def _insert_card(conn, card, position):
    extra = {k: v for k, v in card.items() if k not in CORE_FIELDS}
    conn.execute(
        "INSERT INTO cards (id, position, front, back, absolutely_required, extra, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (card["id"], position, card.get("front", ""), card.get("back", ""),
         1 if card.get("absolutelyRequired") else 0,
         json.dumps(extra, sort_keys=True, ensure_ascii=False), now_ms()))
    for i, tag in enumerate(card.get("tags", [])):
        conn.execute("INSERT INTO tags (card_id, ord, tag) VALUES (?, ?, ?)", (card["id"], i, tag))
    for a in card.get("attempts", []):
        conn.execute("INSERT INTO attempts (card_id, ts, correct, reason) VALUES (?, ?, ?, ?)",
                     (card["id"], a["timestamp"], 1 if a["correct"] else 0, a.get("reason")))


def import_cards(cards):
    """Replace the whole database with `cards` (list of JSON card dicts).

    Duplicate card ids get a fresh id (the browser looks cards up by id).
    Returns a list of (old_id, new_id) for any renumbered cards.
    """
    renumbered = []
    seen = set()
    next_id = max([c["id"] for c in cards] + [now_ms()]) + 1
    with connect() as conn:
        conn.executescript(SCHEMA)
        conn.execute("DELETE FROM attempts")
        conn.execute("DELETE FROM tags")
        conn.execute("DELETE FROM cards")
        for pos, card in enumerate(cards):
            card = dict(card)
            if card["id"] in seen:
                renumbered.append((card["id"], next_id))
                card["id"] = next_id
                next_id += 1
            seen.add(card["id"])
            _insert_card(conn, card, pos)
    for old, new in renumbered:
        print(f"[store] duplicate card id {old}: second copy renumbered to {new}", file=sys.stderr)
    return renumbered


def _card_dict(conn, row):
    card = json.loads(row["extra"])
    card.update({
        "id": row["id"],
        "front": row["front"],
        "back": row["back"],
        "absolutelyRequired": bool(row["absolutely_required"]),
        "tags": [r["tag"] for r in conn.execute(
            "SELECT tag FROM tags WHERE card_id = ? ORDER BY ord", (row["id"],))],
        "attempts": [],
    })
    for a in conn.execute(
            "SELECT ts, correct, reason FROM attempts WHERE card_id = ? ORDER BY ts, id", (row["id"],)):
        attempt = {"timestamp": a["ts"], "correct": bool(a["correct"])}
        if a["reason"]:
            attempt["reason"] = a["reason"]
        card["attempts"].append(attempt)
    return card


def all_cards():
    with connect() as conn:
        return [_card_dict(conn, r) for r in conn.execute("SELECT * FROM cards ORDER BY position")]


def get_card(card_id):
    with connect() as conn:
        row = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        return _card_dict(conn, row) if row else None


def export_json(path=None):
    """Write the deck as stable, diff-friendly JSON (atomic replace)."""
    path = path or json_path()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(all_cards(), f, indent=2, sort_keys=True, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)
    return path


# ---------- per-action writes (one small transaction each) ----------

def _renumber(conn):
    ids = [r["id"] for r in conn.execute("SELECT id FROM cards ORDER BY position, id")]
    conn.executemany("UPDATE cards SET position = ? WHERE id = ?", [(i, cid) for i, cid in enumerate(ids)])


def _position_after(conn, after_id):
    """Position a card should take to sit right after `after_id` (None = first)."""
    if after_id is None:
        return 0
    row = conn.execute("SELECT position FROM cards WHERE id = ?", (after_id,)).fetchone()
    if row is None:  # neighbour gone (deleted elsewhere): append
        return conn.execute("SELECT COALESCE(MAX(position) + 1, 0) FROM cards").fetchone()[0]
    return row["position"] + 1


def add_card(card, after_id=None):
    with connect() as conn:
        if conn.execute("SELECT 1 FROM cards WHERE id = ?", (card["id"],)).fetchone():
            card = dict(card, id=max(now_ms(), conn.execute("SELECT MAX(id) FROM cards").fetchone()[0] + 1))
        pos = _position_after(conn, after_id)
        conn.execute("UPDATE cards SET position = position + 1 WHERE position >= ?", (pos,))
        _insert_card(conn, card, pos)
    return get_card(card["id"])


def update_card(card_id, fields):
    with connect() as conn:
        row = conn.execute("SELECT extra FROM cards WHERE id = ?", (card_id,)).fetchone()
        if row is None:
            return None
        sets, args = [], []
        for key, col in (("front", "front"), ("back", "back")):
            if key in fields:
                sets.append(f"{col} = ?")
                args.append(fields[key])
        if "absolutelyRequired" in fields:
            sets.append("absolutely_required = ?")
            args.append(1 if fields["absolutelyRequired"] else 0)
        extra = json.loads(row["extra"])
        extra_changes = {k: v for k, v in fields.items() if k not in CORE_FIELDS}
        if extra_changes:
            extra.update(extra_changes)
            sets.append("extra = ?")
            args.append(json.dumps(extra, sort_keys=True, ensure_ascii=False))
        sets.append("updated_at = ?")
        args.append(now_ms())
        conn.execute(f"UPDATE cards SET {', '.join(sets)} WHERE id = ?", (*args, card_id))
        if "tags" in fields:
            conn.execute("DELETE FROM tags WHERE card_id = ?", (card_id,))
            conn.executemany("INSERT INTO tags (card_id, ord, tag) VALUES (?, ?, ?)",
                             [(card_id, i, t) for i, t in enumerate(fields["tags"])])
    return get_card(card_id)


def delete_card(card_id):
    with connect() as conn:
        deleted = conn.execute("DELETE FROM cards WHERE id = ?", (card_id,)).rowcount
        _renumber(conn)
    return deleted > 0


def move_card(card_id, after_id):
    """Move a card so it sits right after `after_id` (None = first in the deck)."""
    with connect() as conn:
        ids = [r["id"] for r in conn.execute("SELECT id FROM cards ORDER BY position, id")]
        if card_id not in ids:
            return False
        ids.remove(card_id)
        pos = ids.index(after_id) + 1 if after_id in ids else (0 if after_id is None else len(ids))
        ids.insert(pos, card_id)
        conn.executemany("UPDATE cards SET position = ? WHERE id = ?", [(i, cid) for i, cid in enumerate(ids)])
    return True


def add_attempt(card_id, timestamp, correct, reason=None):
    with connect() as conn:
        if not conn.execute("SELECT 1 FROM cards WHERE id = ?", (card_id,)).fetchone():
            return False
        conn.execute("INSERT INTO attempts (card_id, ts, correct, reason) VALUES (?, ?, ?, ?)",
                     (card_id, int(timestamp), 1 if correct else 0, reason or None))
    return True


def delete_attempt(card_id, timestamp):
    with connect() as conn:
        return conn.execute("DELETE FROM attempts WHERE card_id = ? AND ts = ?",
                            (card_id, int(timestamp))).rowcount > 0


def clear_attempts(card_id):
    with connect() as conn:
        conn.execute("DELETE FROM attempts WHERE card_id = ?", (card_id,))
    return True


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "export":
        init()
        print(export_json())
    elif cmd == "import":
        with open(json_path(), encoding="utf-8") as f:
            cards = json.load(f)
        import_cards(cards)
        print(f"imported {len(cards)} cards into {db_path()}")
    else:
        sys.exit(__doc__)
