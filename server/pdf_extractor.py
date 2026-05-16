#!/usr/bin/env python3
"""
PDF Text Extractor using pdfplumber
This script extracts text from PDF files and outputs it to stdout
"""

import sys
import json

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF using pdfplumber"""
    try:
        import pdfplumber
    except ImportError:
        print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}))
        sys.exit(1)
    
    try:
        full_text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
        
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
