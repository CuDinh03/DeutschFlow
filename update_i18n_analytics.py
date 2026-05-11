import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'analytics': {
        'analyzing': {'vi': 'Đang phân tích từ vựng...', 'en': 'Analyzing vocabulary...', 'de': 'Vokabeln werden analysiert...'},
        'retry': {'vi': 'Thử lại', 'en': 'Retry', 'de': 'Erneut versuchen'},
        'vocabCoverage': {'vi': 'Độ phủ từ vựng', 'en': 'Vocabulary Coverage', 'de': 'Vokabelabdeckung'},
        'wordsInSystem': {'vi': 'từ trong hệ thống', 'en': 'words in system', 'de': 'Wörter im System'},
        'nounsWithGender': {'vi': 'Danh từ có giống', 'en': 'Nouns with gender', 'de': 'Nomen mit Genus'},
        'verbsConjugated': {'vi': 'Động từ có chia', 'en': 'Conjugated verbs', 'de': 'Konjugierte Verben'},
        'vocabDetails': {'vi': 'Chi tiết từ vựng', 'en': 'Vocabulary Details', 'de': 'Vokabeldetails'},
        'nouns': {'vi': 'Danh từ (Nomen)', 'en': 'Nouns', 'de': 'Nomen'},
        'verbs': {'vi': 'Động từ (Verben)', 'en': 'Verbs', 'de': 'Verben'}
    }
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'analytics' not in data:
        data['analytics'] = {}
        
    for key, translations in new_keys['analytics'].items():
        data['analytics'][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
