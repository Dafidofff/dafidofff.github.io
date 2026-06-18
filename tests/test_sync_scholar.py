"""Tests for scripts/sync_scholar.py."""

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch

# Make scripts/ importable
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from sync_scholar import (  # noqa: E402
    PaperPageParser,
    ScholarProfileParser,
    normalize_title,
    parse_year,
    sync_papers,
)


# ---------------------------------------------------------------------------
# normalize_title
# ---------------------------------------------------------------------------

class TestNormalizeTitle:
    def test_lowercases(self):
        assert normalize_title("Hello World") == "hello world"

    def test_strips_punctuation(self):
        assert normalize_title("Hello, World!") == "hello world"

    def test_strips_whitespace(self):
        assert normalize_title("  hello  ") == "hello"

    def test_keeps_digits(self):
        assert normalize_title("ResNet-50: A Study") == "resnet50 a study"

    def test_empty_string(self):
        assert normalize_title("") == ""


# ---------------------------------------------------------------------------
# parse_year
# ---------------------------------------------------------------------------

class TestParseYear:
    def test_plain_year(self):
        assert parse_year("2023") == 2023

    def test_year_in_sentence(self):
        assert parse_year("Published in 2021") == 2021

    def test_no_year(self):
        assert parse_year("no year here") == 0

    def test_empty_string(self):
        assert parse_year("") == 0

    def test_integer_input(self):
        assert parse_year(2020) == 2020


# ---------------------------------------------------------------------------
# ScholarProfileParser
# ---------------------------------------------------------------------------

_PROFILE_HTML = """
<tr class="gsc_a_tr">
  <td>
    <a class="gsc_a_at" href="/citations?view_op=view_citation&hl=en&citation_for_view=abc123">
      My Great Paper
    </a>
    <div class="gs_gray">Alice, Bob</div>
    <div class="gs_gray">NeurIPS 2023</div>
  </td>
  <td>
    <span class="gsc_a_h gsc_a_hc gs_ibl">2023</span>
  </td>
</tr>
"""


class TestScholarProfileParser:
    def _parse(self, html):
        p = ScholarProfileParser()
        p.feed(html)
        return p.papers

    def test_extracts_title(self):
        papers = self._parse(_PROFILE_HTML)
        assert len(papers) == 1
        assert papers[0]["title"] == "My Great Paper"

    def test_extracts_authors(self):
        papers = self._parse(_PROFILE_HTML)
        assert papers[0]["authors"] == "Alice, Bob"

    def test_extracts_venue(self):
        papers = self._parse(_PROFILE_HTML)
        assert papers[0]["venue"] == "NeurIPS 2023"

    def test_extracts_year(self):
        papers = self._parse(_PROFILE_HTML)
        assert papers[0]["year"] == "2023"

    def test_extracts_link(self):
        papers = self._parse(_PROFILE_HTML)
        assert papers[0]["link"].startswith("https://scholar.google.com")
        assert "citation_for_view=abc123" in papers[0]["link"]

    def test_empty_html(self):
        papers = self._parse("")
        assert papers == []

    def test_no_matching_rows(self):
        papers = self._parse("<tr class='other'><td>stuff</td></tr>")
        assert papers == []


# ---------------------------------------------------------------------------
# PaperPageParser
# ---------------------------------------------------------------------------

_PAPER_PAGE_HTML = """
<div class="gsc_oci_title_ggi">
  <a href="https://example.com/paper.pdf">PDF</a>
</div>
"""


class TestPaperPageParser:
    def _parse(self, html):
        p = PaperPageParser()
        p.feed(html)
        return p.pdf_url

    def test_extracts_pdf_url(self):
        url = self._parse(_PAPER_PAGE_HTML)
        assert url == "https://example.com/paper.pdf"

    def test_no_pdf_returns_none(self):
        url = self._parse("<div><a href='nope.html'>No PDF here</a></div>")
        assert url is None

    def test_empty_html(self):
        url = self._parse("")
        assert url is None


# ---------------------------------------------------------------------------
# sync_papers integration (filesystem mocked)
# ---------------------------------------------------------------------------

_FETCHED_PAPERS = [
    {
        "title": "Brand New Paper",
        "authors": "Alice",
        "venue": "ICML 2024",
        "year": "2024",
        "link": "https://scholar.google.com/citations?view_op=view_citation&foo=bar",
    }
]


class TestSyncPapers(unittest.TestCase):
    def _run_sync(self, existing_papers, fetched_papers, pdf_url=None):
        """Run sync_papers with mocked I/O."""
        papers_file = "/fake/papers.json"
        existing_json = json.dumps(existing_papers)

        with (
            patch("sync_scholar.fetch_scholar_papers", return_value=fetched_papers),
            patch("sync_scholar.fetch_pdf_link", return_value=pdf_url),
            patch("pathlib.Path.exists", return_value=True),
            patch("pathlib.Path.read_text", return_value=existing_json),
            patch("pathlib.Path.write_text") as mock_write,
        ):
            count = sync_papers("FAKE_ID", papers_file)
            written = mock_write.call_args[0][0] if mock_write.called else None
            return count, written

    def test_adds_new_paper(self):
        count, written = self._run_sync([], _FETCHED_PAPERS)
        assert count == 1
        data = json.loads(written)
        assert data[0]["title"] == "Brand New Paper"

    def test_skips_existing_paper(self):
        existing = [{"title": "Brand New Paper", "authors": "Alice", "year": 2024, "venue": "ICML 2024", "links": {}}]
        count, _ = self._run_sync(existing, _FETCHED_PAPERS)
        assert count == 0

    def test_adds_pdf_link_when_available(self):
        count, written = self._run_sync([], _FETCHED_PAPERS, pdf_url="https://example.com/new.pdf")
        data = json.loads(written)
        assert data[0]["links"].get("pdf") == "https://example.com/new.pdf"

    def test_preserves_existing_manual_links(self):
        existing = [
            {
                "title": "Old Paper",
                "authors": "Bob",
                "year": 2020,
                "venue": "ICLR 2020",
                "links": {"code": "https://github.com/example"},
            }
        ]
        count, written = self._run_sync(existing, _FETCHED_PAPERS)
        data = json.loads(written)
        old = next(p for p in data if p["title"] == "Old Paper")
        assert old["links"]["code"] == "https://github.com/example"

    def test_sorts_by_year_descending(self):
        existing = [{"title": "Older Paper", "authors": "X", "year": 2010, "venue": "Old Conf", "links": {}}]
        count, written = self._run_sync(existing, _FETCHED_PAPERS)
        data = json.loads(written)
        years = [p["year"] for p in data]
        assert years == sorted(years, reverse=True)

    def test_handles_missing_papers_file(self):
        """Should start from an empty list if the file doesn't exist."""
        papers_file = "/fake/papers.json"
        with (
            patch("sync_scholar.fetch_scholar_papers", return_value=_FETCHED_PAPERS),
            patch("sync_scholar.fetch_pdf_link", return_value=None),
            patch("pathlib.Path.exists", return_value=False),
            patch("pathlib.Path.write_text") as mock_write,
        ):
            count = sync_papers("FAKE_ID", papers_file)
        assert count == 1

    def test_handles_corrupt_papers_file(self):
        """Should recover gracefully from invalid JSON."""
        papers_file = "/fake/papers.json"
        with (
            patch("sync_scholar.fetch_scholar_papers", return_value=_FETCHED_PAPERS),
            patch("sync_scholar.fetch_pdf_link", return_value=None),
            patch("pathlib.Path.exists", return_value=True),
            patch("pathlib.Path.read_text", return_value="NOT JSON {{{"),
            patch("pathlib.Path.write_text"),
        ):
            count = sync_papers("FAKE_ID", papers_file)
        assert count == 1
