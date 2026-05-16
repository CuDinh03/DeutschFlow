#!/usr/bin/env python3
import os
import re
import sys

def main():
    # Regular expression to match Vietnamese text that is NOT wrapped in t()
    # This is a naive regex for the sake of the CI check demonstration.
    # It looks for typical Vietnamese characters in JSX text nodes.
    vietnamese_chars = r'[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ]'
    
    # We will only look at .tsx and .jsx files in the src directory
    frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "src")
    
    found_errors = False
    
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith((".tsx", ".jsx")):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    
                # Very basic check: if we see raw Vietnamese chars that might be hardcoded in JSX.
                # In a real-world scenario, you'd use an AST parser or a more robust regex that ignores comments/imports.
                # For this implementation, we just look for text containing vietnamese chars between > and <
                
                matches = re.finditer(r'>([^<]*' + vietnamese_chars + r'[^<]*)<', content)
                for match in matches:
                    text = match.group(1).strip()
                    # ignore empty or purely whitespace
                    if text and not text.startswith('{') and not text.endswith('}'):
                        print(f"[i18n VIOLATION] Hardcoded text found in {filepath}: '{text}'")
                        found_errors = True
                        
    if found_errors:
        print("\nERROR: Hardcoded Vietnamese strings detected. Please use the useTranslations() hook and map them to vi.json/de.json.")
        sys.exit(1)
    else:
        print("SUCCESS: No hardcoded Vietnamese strings detected in JSX text nodes.")
        sys.exit(0)

if __name__ == "__main__":
    main()
