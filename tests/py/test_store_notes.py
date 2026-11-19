"""Run: python3 -m unittest discover -s tests/py"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))
import store  # noqa: E402


class NotesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["PERDISCO_DATA"] = self.tmp.name
        store.init()
        store.add_card({"id": 1, "front": "f", "back": "b", "tags": [], "attempts": []})

    def tearDown(self):
        self.tmp.cleanup()

    def test_add_delete(self):
        self.assertTrue(store.add_note(1, 200, "second"))
        self.assertTrue(store.add_note(1, 100, "first\nline two"))
        self.assertFalse(store.add_note(1, 300, "   "), "empty note refused")
        self.assertFalse(store.add_note(99, 300, "x"), "unknown card")
        self.assertEqual(store.get_card(1)["notes"],
                         [{"timestamp": 100, "text": "first\nline two"}, {"timestamp": 200, "text": "second"}])
        self.assertTrue(store.delete_note(1, 100))
        self.assertFalse(store.delete_note(1, 100))
        self.assertEqual([n["text"] for n in store.get_card(1)["notes"]], ["second"])

    def test_export_import_round_trip(self):
        store.add_note(1, 100, "idea")
        with open(store.export_json(), encoding="utf-8") as f:
            cards = json.load(f)
        self.assertEqual(cards[0]["notes"], [{"timestamp": 100, "text": "idea"}])
        store.import_cards(cards)
        self.assertEqual(store.get_card(1)["notes"], [{"timestamp": 100, "text": "idea"}])

    def test_deleting_card_deletes_notes(self):
        store.add_note(1, 100, "idea")
        store.delete_card(1)
        with store.connect() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
