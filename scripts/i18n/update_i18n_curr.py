import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'curriculum': {
        'themes': {'vi': 'Chủ đề', 'en': 'Themes', 'de': 'Themen'},
        'grammar': {'vi': 'Ngữ pháp', 'en': 'Grammar', 'de': 'Grammatik'},
        'vocabulary': {'vi': 'Từ vựng ({count})', 'en': 'Vocabulary ({count})', 'de': 'Vokabeln ({count})'},
        'moreWords': {'vi': '+{count} từ nữa', 'en': '+{count} more words', 'de': '+{count} weitere Wörter'},
        'communicativeGoals': {'vi': 'Mục tiêu giao tiếp', 'en': 'Communicative Goals', 'de': 'Kommunikationsziele'}
    }
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'curriculum' not in data:
        data['curriculum'] = {}
        
    for key, translations in new_keys['curriculum'].items():
        data['curriculum'][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
