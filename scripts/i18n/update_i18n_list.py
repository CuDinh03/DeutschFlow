import json
import os

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'roadmap': {
        'learning': {'vi': 'Đang học', 'en': 'Learning', 'de': 'Lernen'},
        'week': {'vi': 'Tuần', 'en': 'Week', 'de': 'Woche'},
        'lessonsCompleted': {'vi': 'bài hoàn thành', 'en': 'lessons completed', 'de': 'Lektionen abgeschlossen'},
        'continue': {'vi': 'Tiếp tục', 'en': 'Continue', 'de': 'Weiter'},
        'optimizing': {'vi': 'Đang tối ưu lộ trình AI...', 'en': 'Optimizing AI roadmap...', 'de': 'KI-Lernpfad wird optimiert...'},
        'corePath': {'vi': 'Lộ trình cốt lõi', 'en': 'Core Path', 'de': 'Kernpfad'},
        'satellitePath': {'vi': 'Nhánh phụ (Mở rộng)', 'en': 'Satellite Path (Extension)', 'de': 'Zusatzpfad (Erweiterung)'},
        'completed': {'vi': 'Hoàn thành', 'en': 'Completed', 'de': 'Abgeschlossen'},
        'review': {'vi': 'Ôn tập lại', 'en': 'Review', 'de': 'Wiederholen'},
        'start': {'vi': 'Bắt đầu', 'en': 'Start', 'de': 'Start'},
        'locked': {'vi': 'Khoá', 'en': 'Locked', 'de': 'Gesperrt'}
    }
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for namespace, keys in new_keys.items():
        if namespace not in data:
            data[namespace] = {}
        for key, translations in keys.items():
            data[namespace][key] = translations[lang] # overwrite to be sure
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
