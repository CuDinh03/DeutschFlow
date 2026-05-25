import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'learn': {
        'grammar': {'vi': 'Ngữ pháp', 'en': 'Grammar', 'de': 'Grammatik'},
        'reading': {'vi': 'Đọc', 'en': 'Reading', 'de': 'Lesen'},
        'listening': {'vi': 'Nghe', 'en': 'Listening', 'de': 'Hören'},
        'speaking': {'vi': 'Nói', 'en': 'Speaking', 'de': 'Sprechen'},
        'writing': {'vi': 'Viết', 'en': 'Writing', 'de': 'Schreiben'},
        'phoneme': {'vi': 'Phát âm', 'en': 'Pronunciation', 'de': 'Aussprache'},
        'lesson': {'vi': 'Bài học', 'en': 'Lesson', 'de': 'Lektion'},
        'loadingNode': {'vi': 'Đang tải...', 'en': 'Loading...', 'de': 'Lädt...'},
        'backToRoadmap': {'vi': 'Quay lại Lộ trình', 'en': 'Back to Roadmap', 'de': 'Zurück zum Lernpfad'},
        'loadingLesson': {'vi': 'Đang tải bài học...', 'en': 'Loading lesson...', 'de': 'Lektion wird geladen...'},
        'aiCreating': {'vi': 'Bài học đang được tạo bởi AI...', 'en': 'Lesson is being created by AI...', 'de': 'Lektion wird von der KI erstellt...'},
        'comeBackLater': {'vi': 'Vui lòng quay lại sau vài phút.', 'en': 'Please come back in a few minutes.', 'de': 'Bitte kommen Sie in ein paar Minuten zurück.'},
        'practicePronunciation': {'vi': 'Luyện phát âm từng từ/cụm từ trong bài học', 'en': 'Practice pronunciation of words/phrases in the lesson', 'de': 'Üben Sie die Aussprache von Wörtern/Phrasen in der Lektion'},
        'otherWords': {'vi': 'Từ khác trong bài', 'en': 'Other words in the lesson', 'de': 'Andere Wörter in der Lektion'},
        'phonemeSuccess': {'vi': 'Đã hoàn thành phần Phát âm (≥ 80% đúng)', 'en': 'Pronunciation section completed (≥ 80% correct)', 'de': 'Aussprachebereich abgeschlossen (≥ 80% richtig)'},
        'completionHint': {'vi': 'Hoàn thành tất cả các kỹ năng (100% đúng hoặc ≥ 80 điểm) để mở khoá bài tiếp theo.', 'en': 'Complete all skills (100% correct or ≥ 80 points) to unlock the next lesson.', 'de': 'Schließe alle Fähigkeiten ab (100% richtig oder ≥ 80 Punkte), um die nächste Lektion freizuschalten.'}
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
