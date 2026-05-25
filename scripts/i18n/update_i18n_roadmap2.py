import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'roadmap': {
        'coreProgress': {'vi': 'Tiến độ CORE', 'en': 'CORE Progress', 'de': 'KERN-Fortschritt'},
        'completedPercent': {'vi': 'hoàn thành', 'en': 'completed', 'de': 'abgeschlossen'},
        'totalXp': {'vi': 'Tổng XP', 'en': 'Total XP', 'de': 'Gesamt-XP'},
        'lessonsDone': {'vi': 'Bài xong', 'en': 'Lessons done', 'de': 'Lektionen beendet'},
        'streakDaysLabel': {'vi': 'Chuỗi ngày', 'en': 'Streak days', 'de': 'Tages-Streak'},
        'addedPractice': {'vi': 'Đã thêm bài luyện "{error}" vào Tuần {week} · Phiên {session}', 'en': 'Added practice "{error}" to Week {week} · Session {session}', 'de': 'Übung "{error}" zu Woche {week} · Sitzung {session} hinzugefügt'}
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
