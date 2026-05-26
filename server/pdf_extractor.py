#!/usr/bin/env python3
"""
PDF Text Extractor using pdfplumber and OCR (Tesseract)
This script extracts text from PDF files and outputs it to stdout
"""

import sys
import json
import os

def extract_text_with_ocr(pdf_path):
    """Extract text from image-based PDF using OCR"""
    try:
        import pytesseract
        from pdf2image import convert_from_path
        from PIL import Image
    except ImportError as e:
        return {"error": f"OCR packages not installed. Run: pip install pytesseract pdf2image Pillow. Error: {str(e)}"}
    
    try:
        # Set Tesseract path for Windows
        if os.name == 'nt':  # Windows
            tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
            else:
                # Try alternative path
                tesseract_path = r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe'
                if os.path.exists(tesseract_path):
                    pytesseract.pytesseract.tesseract_cmd = tesseract_path
        
        # Set Poppler path for Windows (required by pdf2image)
        poppler_path = None
        if os.name == 'nt':  # Windows
            # Check if poppler is in the extracted folder
            poppler_path = r'D:\testfyrwanda-main\poppler\poppler-23.07.0\Library\bin'
            if os.path.exists(poppler_path):
                print(f"Using Poppler from: {poppler_path}", file=sys.stderr)
            else:
                print(f"Poppler not found at: {poppler_path}", file=sys.stderr)
        
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
        
        return {"success": True, "text": full_text, "method": "pdfplumber"}
    except Exception as e:
        return {"error": f"Failed to parse PDF: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python pdf_extractor.py <pdf_path>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_text_from_pdf(pdf_path)
    print(json.dumps(result))
