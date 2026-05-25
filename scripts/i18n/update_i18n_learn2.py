import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'learn': {
        'vocabularyCount': {'vi': 'Từ vựng ({count})', 'en': 'Vocabulary ({count})', 'de': 'Vokabeln ({count})'},
        'completed100': {'vi': 'Đã hoàn thành 100%', 'en': '100% Completed', 'de': '100% Abgeschlossen'},
        'readAndUnderstood': {'vi': 'Đã đọc & Hiểu (100%)', 'en': 'Read & Understood (100%)', 'de': 'Gelesen & Verstanden (100%)'},
        'tapToRecord': {'vi': 'Nhấn để thu âm', 'en': 'Tap to record', 'de': 'Tippen zum Aufnehmen'}
    }
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'learn' not in data:
        data['learn'] = {}
        
    for key, translations in new_keys['learn'].items():
        data['learn'][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
