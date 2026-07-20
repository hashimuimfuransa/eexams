#!/usr/bin/env python3
"""
PDF Text Extractor using pdfplumber and OCR (Tesseract)
This script extracts text from PDF files and outputs it to stdout
"""

import sys
import json
import os
import re
import io
import base64
import glob

# Phrases that reliably indicate a page contains a diagram/figure the question depends on
# (REB/exam-board wording: "the diagram below", "figure 3", "shown below/above", etc).
DIAGRAM_KEYWORD_PATTERN = re.compile(
    r'(diagram|figure\s*\d*|graph|chart|illustration)\s+(below|above|shown)|'
    r'(shown|represented)\s+(below|above|in\s+the\s+diagram)|'
    r'label\s+the\s+(parts?|structures?)|'
    r'study\s+the\s+(diagram|figure)|'
    r'the\s+following\s+(diagram|figure)',
    re.IGNORECASE
)


def _resolve_poppler_path():
    """Resolve the poppler /bin folder: POPPLER_PATH env var -> repo-relative poppler-*/Library/bin -> None (rely on PATH)."""
    env_poppler = os.environ.get('POPPLER_PATH')
    if env_poppler and os.path.exists(env_poppler):
        return env_poppler
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidates = glob.glob(os.path.join(repo_root, 'poppler', 'poppler-*', 'Library', 'bin'))
    if candidates:
        return candidates[0]
    return None


def extract_text_with_ocr(pdf_path):
    """Extract text from image-based PDF using OCR"""
    try:
        import pytesseract
        from pdf2image import convert_from_path
        from PIL import Image
    except ImportError as e:
        return {"error": f"OCR packages not installed. Run: pip install pytesseract pdf2image Pillow. Error: {str(e)}"}

    try:
        # Set Tesseract path: allow an explicit override via TESSERACT_PATH env var (for
        # deployments like Render/Linux where tesseract is installed on PATH via apt, this
        # should be left unset so pytesseract just calls `tesseract` directly).
        env_tesseract = os.environ.get('TESSERACT_PATH')
        if env_tesseract and os.path.exists(env_tesseract):
            pytesseract.pytesseract.tesseract_cmd = env_tesseract
        elif os.name == 'nt':  # Windows dev fallback
            for tesseract_path in (r'C:\Program Files\Tesseract-OCR\tesseract.exe',
                                    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe'):
                if os.path.exists(tesseract_path):
                    pytesseract.pytesseract.tesseract_cmd = tesseract_path
                    break

        # Set Poppler path (required by pdf2image on Windows; on Linux/Render, poppler-utils
        # installed via the package manager is already on PATH and no override is needed).
        poppler_path = _resolve_poppler_path()
        if poppler_path:
            print(f"Using Poppler from: {poppler_path}", file=sys.stderr)
        else:
            print("No local Poppler folder found; relying on system PATH", file=sys.stderr)

        full_text = ""

        # Convert PDF to images
        print("Converting PDF to images for OCR...", file=sys.stderr)
        if poppler_path:
            images = convert_from_path(pdf_path, dpi=200, poppler_path=poppler_path)
        else:
            images = convert_from_path(pdf_path, dpi=200)

        for page_num, image in enumerate(images, start=1):
            # Extract text using OCR
            text = pytesseract.image_to_string(image, lang='eng')

            if text and text.strip():
                full_text += f"\n--- PAGE {page_num} ---\n"
                full_text += text + "\n"

        if not full_text or full_text.strip() == "":
            return {"error": "OCR failed to extract any text from the PDF"}

        return {"success": True, "text": full_text, "method": "OCR"}
    except Exception as e:
        return {"error": f"OCR extraction failed: {str(e)}"}


def extract_diagram_images(pdf_path, page_snippets):
    """
    Render each page in page_snippets (a dict of page_num -> nearby text snippet) to a PNG
    image, so questions referencing "the diagram below"/"figure N" etc keep their visual
    content. Best-effort: any failure here must not break text extraction, so every error is
    caught and simply results in fewer (or no) images rather than a failed request.
    """
    if not page_snippets:
        return []
    try:
        from pdf2image import convert_from_path
    except ImportError as e:
        print(f"Skipping diagram image extraction, pdf2image not available: {e}", file=sys.stderr)
        return []

    poppler_path = _resolve_poppler_path()
    images_out = []
    for page_num, snippet in page_snippets.items():
        try:
            kwargs = {"dpi": 150, "first_page": page_num, "last_page": page_num}
            if poppler_path:
                kwargs["poppler_path"] = poppler_path
            rendered = convert_from_path(pdf_path, **kwargs)
            if not rendered:
                continue
            buf = io.BytesIO()
            rendered[0].save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            images_out.append({
                "page": page_num,
                "snippet": snippet[:800],
                "dataUrl": f"data:image/png;base64,{b64}"
            })
            print(f"Rendered diagram image for page {page_num} ({len(b64)} base64 chars)", file=sys.stderr)
        except Exception as e:
            print(f"Failed to render diagram image for page {page_num}: {e}", file=sys.stderr)
            continue
    return images_out


def render_all_pages(pdf_path, max_pages=15, dpi=130):
    """
    Render every page of the PDF (up to max_pages) to a PNG data URL, for the vision-model
    extraction path: the whole document is handed to a vision LLM as images instead of relying
    on pdfplumber's text layer, so scanned pages, handwriting, and complex tables/diagrams that
    pdfplumber/OCR struggle with can still be read. Reuses the same Poppler resolution as
    extract_diagram_images. Best-effort per page — one failed page is skipped, not fatal.
    """
    try:
        from pdf2image import convert_from_path
    except ImportError as e:
        return {"error": f"pdf2image not available: {e}"}

    poppler_path = _resolve_poppler_path()
    try:
        kwargs = {"dpi": dpi, "first_page": 1, "last_page": max_pages}
        if poppler_path:
            kwargs["poppler_path"] = poppler_path
        rendered = convert_from_path(pdf_path, **kwargs)
    except Exception as e:
        return {"error": f"Failed to render PDF pages: {str(e)}"}

    pages_out = []
    for page_num, image in enumerate(rendered, start=1):
        try:
            buf = io.BytesIO()
            image.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            pages_out.append({"page": page_num, "dataUrl": f"data:image/png;base64,{b64}"})
        except Exception as e:
            print(f"Failed to encode page {page_num}: {e}", file=sys.stderr)
            continue

    if not pages_out:
        return {"error": "No pages could be rendered to images"}
    return {"success": True, "pages": pages_out}


def extract_text_from_pdf(pdf_path):
    """Extract text from PDF using pdfplumber with enhanced formatting preservation"""
    try:
        import pdfplumber
    except ImportError:
        print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}))
        sys.exit(1)

    try:
        full_text = ""
        diagram_pages = {}  # page_num -> text snippet, for pages that reference a diagram/figure
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                # Extract text with layout preservation
                text = page.extract_text()

                if text:
                    # Add page separator for better structure
                    full_text += f"\n--- PAGE {page_num} ---\n"
                    # Preserve underscores and blank markers by replacing common OCR artifacts
                    # Replace common OCR patterns that might replace underscores
                    text = text.replace('_____', '_____')
                    text = text.replace('____', '____')
                    text = text.replace('___', '___')
                    text = text.replace('__', '__')
                    # Add explicit blank markers where patterns suggest fill-in-blank
                    # Look for patterns like "with ______" and ensure blanks are preserved
                    text = re.sub(r'(\w+)\s+([_]{3,})', r'\1 \2', text)
                    full_text += text + "\n"

                    if DIAGRAM_KEYWORD_PATTERN.search(text):
                        diagram_pages[page_num] = text

                # Also try to extract tables if present (for structured data)
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        full_text += "\n[TABLE]\n"
                        for row in table:
                            row_text = " | ".join([str(cell) if cell else "" for cell in row])
                            full_text += row_text + "\n"
                        full_text += "[/TABLE]\n"

        # If very little text was extracted, try OCR
        # Use a higher threshold to catch PDFs with only page numbers/footers
        if not full_text or len(full_text.strip()) < 2000:
            print("Insufficient text extracted, trying OCR...", file=sys.stderr)
            ocr_result = extract_text_with_ocr(pdf_path)
            if ocr_result.get("success"):
                return ocr_result
            # If OCR also fails, return the original error
            if not full_text or full_text.strip() == "":
                return {"error": "No text found in PDF. The PDF may be image-based or corrupted."}

        images = extract_diagram_images(pdf_path, diagram_pages)

        return {"success": True, "text": full_text, "method": "pdfplumber", "images": images}
    except Exception as e:
        return {"error": f"Failed to parse PDF: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python pdf_extractor.py <pdf_path> [--render-pages]"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if len(sys.argv) > 2 and sys.argv[2] == '--render-pages':
        result = render_all_pages(pdf_path)
    else:
        result = extract_text_from_pdf(pdf_path)
    print(json.dumps(result))
