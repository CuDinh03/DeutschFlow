import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'roadmap': {
        'loading28Days': {'vi': 'Đang tải lộ trình 28 ngày...', 'en': 'Loading 28-day roadmap...', 'de': 'Lade 28-Tage-Lernpfad...'},
        'retry': {'vi': 'Thử lại', 'en': 'Retry', 'de': 'Erneut versuchen'},
        'noRoadmap': {'vi': 'Chưa có lộ trình. Hãy hoàn thành Onboarding.', 'en': 'No roadmap yet. Please complete Onboarding.', 'de': 'Noch kein Lernpfad. Bitte Onboarding abschließen.'},
        'specializedLessons': {'vi': 'Bài chuyên ngành', 'en': 'Specialized Lessons', 'de': 'Fachspezifische Lektionen'},
        'opensAfterDay14': {'vi': 'Mở sau Day 14', 'en': 'Opens after Day 14', 'de': 'Öffnet nach Tag 14'},
        'needXDays': {'vi': 'Cần {days} ngày nữa', 'en': 'Needs {days} more days', 'de': 'Noch {days} Tage benötigt'},
        'unlocked': {'vi': 'Mở', 'en': 'Unlocked', 'de': 'Entsperrt'}
    }
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'roadmap' not in data:
        data['roadmap'] = {}
        
    for key, translations in new_keys['roadmap'].items():
        data['roadmap'][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
