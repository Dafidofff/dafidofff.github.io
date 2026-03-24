#!/usr/bin/env python3
"""
Sync Google Scholar publications to papers.json.

Fetches all publications from a Google Scholar profile and updates
papers.json with any new papers found. Existing papers (matched by title)
are left untouched so manual edits (code links, project pages) are preserved.

Usage:
    python sync_scholar.py --scholar-id <SCHOLAR_ID> [--papers-file papers.json]

The Scholar ID is the "user" parameter from your Google Scholar profile URL:
    https://scholar.google.com/citations?user=XXXXXXXX
                                              ^^^^^^^^ this part
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


def fetch_page(url, retries=3):
    """Fetch a URL with retries and a browser-like User-Agent."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f"  Retry {attempt + 1}/{retries} after error: {e}. Waiting {wait}s...")
                time.sleep(wait)
            else:
                raise


class ScholarProfileParser(HTMLParser):
    """Parse the Google Scholar profile page to extract publication entries."""

    def __init__(self):
        super().__init__()
        self.papers = []
        self._current = None
        self._capture = None
        self._in_row = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get("class", "")

        # Each publication row
        if tag == "tr" and "gsc_a_tr" in cls:
            self._in_row = True
            self._current = {"title": "", "authors": "", "venue": "", "year": "", "link": ""}

        if not self._in_row:
            return

        # Title link
        if tag == "a" and "gsc_a_at" in cls:
            self._capture = "title"
            href = attrs_dict.get("href", "")
            if href:
                self._current["link"] = "https://scholar.google.com" + href if href.startswith("/") else href

        # Author/venue lines
        if tag == "div" and "gs_gray" in cls:
            if self._current.get("authors"):
                self._capture = "venue"
            else:
                self._capture = "authors"

        # Year
        if tag == "span" and "gsc_a_h" in cls:
            self._capture = "year"

    def handle_data(self, data):
        if self._capture and self._current is not None:
            self._current[self._capture] += data.strip()

    def handle_endtag(self, tag):
        if self._capture in ("title", "authors", "venue", "year"):
            self._capture = None
        if tag == "tr" and self._in_row:
            self._in_row = False
            if self._current and self._current.get("title"):
                self.papers.append(self._current)
            self._current = None


class PaperPageParser(HTMLParser):
    """Parse an individual Scholar paper page to find PDF links."""

    def __init__(self):
        super().__init__()
        self.pdf_url = None
        self._in_pdf_link = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "div" and "gsc_oci_title_ggi" in attrs_dict.get("class", ""):
            self._in_pdf_link = True
        if self._in_pdf_link and tag == "a":
            href = attrs_dict.get("href", "")
            if href and not self.pdf_url:
                self.pdf_url = href

    def handle_endtag(self, tag):
        if tag == "div" and self._in_pdf_link:
            self._in_pdf_link = False


def fetch_scholar_papers(scholar_id, max_papers=100):
    """Fetch publications from a Google Scholar profile."""
    papers = []
    start = 0
    page_size = 100

    while start < max_papers:
        url = (
            f"https://scholar.google.com/citations?"
            f"user={urllib.parse.quote(scholar_id)}"
            f"&cstart={start}&pagesize={page_size}"
            f"&sortby=pubdate&hl=en"
        )
        print(f"Fetching Scholar profile page (start={start})...")
        html = fetch_page(url)

        parser = ScholarProfileParser()
        parser.feed(html)

        if not parser.papers:
            break

        papers.extend(parser.papers)
        start += page_size

        if len(parser.papers) < page_size:
            break

        time.sleep(2)

    return papers


def is_safe_url(url):
    """Return True only if *url* uses an allowed scheme (http or https)."""
    if not url:
        return False
    parsed = urllib.parse.urlparse(url)
    return parsed.scheme in ("http", "https")


def fetch_pdf_link(paper_url):
    """Try to extract a PDF link from an individual Scholar paper page."""
    try:
        print(f"  Checking for PDF link...")
        html = fetch_page(paper_url)
        parser = PaperPageParser()
        parser.feed(html)
        url = parser.pdf_url
        if url and not is_safe_url(url):
            print("  Dropping PDF link with disallowed scheme.")
            return None
        return url
    except Exception as e:
        print(f"  Could not fetch PDF link: {e}")
        return None


def normalize_title(title):
    """Normalize a paper title for comparison (lowercase, stripped punctuation)."""
    return re.sub(r"[^a-z0-9\s]", "", title.lower()).strip()


def parse_year(year_str):
    """Parse a year string, returning an int or 0."""
    match = re.search(r"(\d{4})", str(year_str))
    return int(match.group(1)) if match else 0


def sync_papers(scholar_id, papers_file):
    """Main sync logic: fetch from Scholar, merge into papers.json."""
    papers_path = Path(papers_file)

    # Load existing papers
    existing = []
    if papers_path.exists():
        try:
            existing = json.loads(papers_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not parse {papers_file}: {e}")
            existing = []

    # Index existing papers by normalized title
    existing_titles = {normalize_title(p["title"]): i for i, p in enumerate(existing)}

    # Fetch from Scholar
    scholar_papers = fetch_scholar_papers(scholar_id)
    print(f"\nFound {len(scholar_papers)} papers on Google Scholar.")

    new_count = 0
    for sp in scholar_papers:
        norm_title = normalize_title(sp["title"])
        year = parse_year(sp["year"])

        if norm_title in existing_titles:
            print(f"  Skipping (already exists): {sp['title'][:60]}...")
            continue

        print(f"  New paper: {sp['title'][:60]}...")

        # Build the paper entry
        entry = {
            "year": year,
            "title": sp["title"],
            "authors": sp["authors"],
            "venue": sp["venue"] if sp["venue"] else "Preprint",
            "links": {},
        }

        # Try to get a PDF link from the paper's detail page
        if sp.get("link") and is_safe_url(sp["link"]):
            time.sleep(1.5)
            pdf_url = fetch_pdf_link(sp["link"])
            if pdf_url:
                entry["links"]["pdf"] = pdf_url

        existing.append(entry)
        existing_titles[norm_title] = len(existing) - 1
        new_count += 1

    # Sort by year descending, then title
    existing.sort(key=lambda p: (-p.get("year", 0), p.get("title", "")))

    # Write back
    papers_path.write_text(
        json.dumps(existing, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"\nDone! Added {new_count} new paper(s). Total: {len(existing)} papers.")
    return new_count


def main():
    parser = argparse.ArgumentParser(description="Sync Google Scholar papers to papers.json")
    parser.add_argument(
        "--scholar-id",
        required=True,
        help="Google Scholar user ID (from your profile URL)",
    )
    parser.add_argument(
        "--papers-file",
        default="papers.json",
        help="Path to papers.json (default: papers.json)",
    )
    args = parser.parse_args()

    if not args.scholar_id:
        print("Error: --scholar-id is required", file=sys.stderr)
        sys.exit(1)

    new_count = sync_papers(args.scholar_id, args.papers_file)

    # Set GitHub Actions output if running in CI
    import os
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a") as f:
            f.write(f"new_papers={new_count}\n")


if __name__ == "__main__":
    main()
