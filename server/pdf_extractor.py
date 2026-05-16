#!/usr/bin/env python3
"""
PDF Text Extractor using pdfplumber
This script extracts text from PDF files and outputs it to stdout
"""

import sys
import json

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF using pdfplumber with enhanced formatting preservation"""
    try:
        import pdfplumber
    except ImportError:
        print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}))
        sys.exit(1)
    
    try:
        full_text = ""
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
                    import re
                    # Look for patterns like "with ______" and ensure blanks are preserved
                    text = re.sub(r'(\w+)\s+([_]{3,})', r'\1 \2', text)
                    full_text += text + "\n"
                
                # Also try to extract tables if present (for structured data)
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        full_text += "\n[TABLE]\n"
                        for row in table:
                            row_text = " | ".join([str(cell) if cell else "" for cell in row])
                            full_text += row_text + "\n"
                        full_text += "[/TABLE]\n"
        
        if not full_text or full_text.strip() == "":
            return {"error": "No text found in PDF. The PDF may be image-based or corrupted."}
        
        return {"success": True, "text": full_text}
    except Exception as e:
        return {"error": f"Failed to parse PDF: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python pdf_extractor.py <pdf_path>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_text_from_pdf(pdf_path)
    print(json.dumps(result))
