#!/usr/bin/env python3
"""Transcript-honesty tests (Nov 3, 2026): the canonical transcriber must never invent words
over garbled audio. Synthetic low-confidence segments only — no model download, no audio.
Run:  python3 -m unittest test_honesty -v     (from this folder)
or:   python3 test_honesty.py
"""
import os
import sys
import unittest
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import transcriber as T


class RenderTests(unittest.TestCase):
    def test_clean_segment_passes_through(self):
        # Same-night clean turn shape: mean ~0.95, min 0.87.
        words = [(" You're", 0.98), (" very", 0.96), (" welcome,", 0.94), (" Tony.", 0.95)]
        self.assertEqual(T.render_segment_text(words), "You're very welcome, Tony.")

    def test_garbled_segment_is_marked_wholesale(self):
        # The garbled usage-test greeting's shape: words the model itself scored 0.07–0.93,
        # mean 0.775 — below the segment floor, so NONE of its guessed words may be stored.
        words = [(" Hey!", 0.62), (" I", 0.90), (" called", 0.31), (" you", 0.88), (" by", 0.31),
                 (" name", 0.07), (" for", 0.93), (" being", 0.91), (" an", 0.95), (" existing", 0.94),
                 (" customer.", 0.93)]
        mean = sum(p for _w, p in words) / len(words)
        self.assertLess(mean, T.SEGMENT_MEAN_FLOOR)  # the fixture really is the garbled shape
        self.assertEqual(T.render_segment_text(words), "[unintelligible]")

    def test_borderline_segment_marks_only_the_bad_word(self):
        # Confirmation-greeting shape: mean above the floor, one word at 0.19.
        words = [(" Hi,", 0.97), (" thanks", 0.95), (" for", 0.19), (" being", 0.93),
                 (" an", 0.96), (" existing", 0.90), (" customer.", 0.88)]
        mean = sum(p for _w, p in words) / len(words)
        self.assertGreaterEqual(mean, T.SEGMENT_MEAN_FLOOR)
        self.assertEqual(T.render_segment_text(words), "Hi, thanks [unintelligible] being an existing customer.")

    def test_consecutive_bad_words_collapse_to_one_marker(self):
        words = [(" The", 0.97), (" truck", 0.05), (" is", 0.11), (" here.", 0.96)]
        # mean = 0.52 -> wholesale mark wins over per-word marking
        self.assertEqual(T.render_segment_text(words), "[unintelligible]")
        words2 = [(" The", 0.99), (" big", 0.98), (" red", 0.97), (" truck", 0.05), (" rig", 0.09),
                  (" is", 0.97), (" parked", 0.98), (" out", 0.96), (" by", 0.95), (" the", 0.99),
                  (" loading", 0.97), (" dock", 0.96), (" today.", 0.95)]
        mean2 = sum(p for _w, p in words2) / len(words2)
        self.assertGreaterEqual(mean2, T.SEGMENT_MEAN_FLOOR)  # long, mostly-clean: per-word marking applies
        self.assertEqual(T.render_segment_text(words2), "The big red [unintelligible] is parked out by the loading dock today.")

    def test_no_word_data_keeps_segment_text(self):
        self.assertEqual(T.render_segment_text(None, "  Some text. "), "Some text.")
        self.assertEqual(T.render_segment_text([], "Fallback."), "Fallback.")
        self.assertEqual(T.render_segment_text(None, ""), "")


class FakeModel:
    """Stands in for faster-whisper: returns synthetic segments with word probabilities."""

    def __init__(self, segments):
        self._segments = segments

    def transcribe(self, samples, **kw):
        assert kw.get("word_timestamps") is True, "transcribe_array must request word timestamps"
        return list(self._segments), SimpleNamespace()


def seg(start, end, text, word_probs):
    words = [SimpleNamespace(word=w, probability=p) for w, p in word_probs] if word_probs is not None else None
    return SimpleNamespace(start=start, end=end, text=text, words=words)


class TranscribeArrayTests(unittest.TestCase):
    def setUp(self):
        self._model = T.MODEL

    def tearDown(self):
        T.MODEL = self._model

    def test_low_confidence_flows_through_pipeline(self):
        T.MODEL = FakeModel([
            seg(0.0, 2.0, " Hey! I called you by name", [(" Hey!", 0.62), (" I", 0.90), (" called", 0.31),
                                                         (" you", 0.88), (" by", 0.31), (" name", 0.07)]),
            seg(2.5, 4.0, " How can I help you today?", [(" How", 0.99), (" can", 0.98), (" I", 0.99),
                                                          (" help", 0.97), (" you", 0.98), (" today?", 0.96)]),
            seg(4.5, 5.0, "   ", None),  # noise segment: dropped as before
        ])
        out = T.transcribe_array([0.0] * 16000)
        self.assertEqual([o["text"] for o in out], ["[unintelligible]", "How can I help you today?"])
        self.assertEqual(out[0]["start"], 0.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
