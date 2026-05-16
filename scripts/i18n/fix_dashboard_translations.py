import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

keys = {
    'loading': {'vi': 'Đang tải dữ liệu hôm nay...', 'en': "Loading today's data...", 'de': 'Lade heutige Daten...'},
    'subtitle': {'vi': 'Hôm nay bạn nên học gì?', 'en': 'What should you learn today?', 'de': 'Was solltest du heute lernen?'},
    'loadError': {'vi': 'Không thể tải dữ liệu. Vui lòng thử lại.', 'en': 'Could not load data. Please try again.', 'de': 'Daten konnten nicht geladen werden. Bitte versuche es erneut.'},
    'retry': {'vi': 'Thử lại', 'en': 'Retry', 'de': 'Wiederholen'},
    'statStreak': {'vi': 'Streak', 'en': 'Streak', 'de': 'Streak'},
    'days': {'vi': 'ngày', 'en': 'days', 'de': 'Tage'},
    'statProgress': {'vi': 'Tiến độ hôm nay', 'en': "Today's progress", 'de': 'Heutiger Fortschritt'},
    'statErrors': {'vi': 'Lỗi cần ôn', 'en': 'Errors to review', 'de': 'Fehler zur Wiederholung'},
    'statAccuracy': {'vi': 'Chính xác', 'en': 'Accuracy', 'de': 'Genauigkeit'},
    'progressTitle': {'vi': 'Tiến độ mục tiêu hôm nay', 'en': "Today's Goal Progress", 'de': 'Heutiger Zielfortschritt'},
    'suggestedTitle': {'vi': '📋 Hôm nay nên làm', 'en': '📋 Suggested for Today', 'de': '📋 Empfohlen für heute'},
    'refresh': {'vi': 'Làm mới', 'en': 'Refresh', 'de': 'Aktualisieren'},
    'minutes': {'vi': '~{n} phút', 'en': '~{n} min', 'de': '~{n} Min.'},
    'start': {'vi': 'Bắt đầu', 'en': 'Start', 'de': 'Starten'},
    'reviewTitle': {'vi': 'Lỗi cần ôn tập', 'en': 'Errors to Review', 'de': 'Fehler zur Wiederholung'},
    'typeVocab': {'vi': 'Từ vựng', 'en': 'Vocabulary', 'de': 'Vokabeln'},
    'typeSpeaking': {'vi': 'Luyện nói', 'en': 'Speaking', 'de': 'Sprechen'},
    'typeGrammar': {'vi': 'Ngữ pháp', 'en': 'Grammar', 'de': 'Grammatik'},
    'typeReview': {'vi': 'Ôn tập', 'en': 'Review', 'de': 'Wiederholung'},
    'lessonSpeaking': {'vi': 'Luyện nói: {topic} ({cefr})', 'en': 'Speaking: {topic} ({cefr})', 'de': 'Sprechen: {topic} ({cefr})'},
    'lessonFree': {'vi': 'Tự do', 'en': 'Free talk', 'de': 'Freies Sprechen'},
    'lessonVocab': {'vi': 'Ôn từ vựng hàng ngày', 'en': 'Daily Vocabulary Review', 'de': 'Tägliche Vokabelwiederholung'},
    'lessonSwipe': {'vi': 'Swipe Cards — ôn nhanh', 'en': 'Swipe Cards — Quick Review', 'de': 'Swipe Cards — Schnelle Wiederholung'},
    'student': {'vi': 'Học viên', 'en': 'Student', 'de': 'Schüler'}
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'dashboard' not in data:
        data['dashboard'] = {}
    for key, translations in keys.items():
        data['dashboard'][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("Dashboard translations added!")
