import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'errors': {
        'other': {'vi': 'Khác', 'en': 'Other', 'de': 'Andere'},
        'loadError': {'vi': 'Không thể tải dữ liệu. Vui lòng thử lại.', 'en': 'Cannot load data. Please try again.', 'de': 'Daten können nicht geladen werden. Bitte versuchen Sie es erneut.'},
        'libraryTitle': {'vi': 'Thư viện lỗi', 'en': 'Error Library', 'de': 'Fehlerbibliothek'},
        'librarySubtitle': {'vi': 'Vết sẹo ngữ pháp — Càng nhớ lâu, càng giỏi nhanh', 'en': 'Grammar scars — The longer you remember, the faster you improve', 'de': 'Grammatiknarben — Je länger du dich erinnerst, desto schneller lernst du'},
        'reviewToday': {'vi': 'Ôn tập hôm nay', 'en': 'Review today', 'de': 'Heute wiederholen'},
        'days': {'vi': 'ngày', 'en': 'days', 'de': 'Tage'},
        'practiceFix': {'vi': 'Luyện sửa lỗi', 'en': 'Practice fixing', 'de': 'Fehlerbehebung üben'},
        'searchPlaceholder': {'vi': 'Tìm kiếm mã lỗi...', 'en': 'Search error code...', 'de': 'Fehlercode suchen...'},
        'loadingErrors': {'vi': 'Đang tải dữ liệu lỗi...', 'en': 'Loading error data...', 'de': 'Fehlerdaten werden geladen...'},
        'retry': {'vi': 'Thử lại', 'en': 'Retry', 'de': 'Erneut versuchen'},
        'noErrorsTitle': {'vi': 'Tuyệt vời! Chưa ghi nhận lỗi nào.', 'en': 'Awesome! No errors recorded yet.', 'de': 'Großartig! Noch keine Fehler registriert.'},
        'noErrorsDesc': {'vi': 'Hãy luyện nói để AI ghi lại các lỗi ngữ pháp của bạn.', 'en': 'Practice speaking so AI can record your grammar errors.', 'de': 'Übe das Sprechen, damit die KI deine Grammatikfehler aufzeichnen kann.'},
        'unfixedErrors': {'vi': 'Lỗi chưa sửa', 'en': 'Unfixed errors', 'de': 'Ungelöste Fehler'},
        'fixed': {'vi': 'Đã sửa', 'en': 'Fixed', 'de': 'Behoben'},
        'seenCount': {'vi': 'Gặp {count} lần', 'en': 'Seen {count} times', 'de': '{count} Mal gesehen'},
        'lastSeen': {'vi': 'Gặp lần cuối:', 'en': 'Last seen:', 'de': 'Zuletzt gesehen:'},
        'recordedGrammarError': {'vi': 'Lỗi ngữ pháp đã ghi nhận', 'en': 'Recorded grammar error', 'de': 'Aufgezeichneter Grammatikfehler'},
        'allDone': {'vi': 'Bạn đã hoàn thành tất cả bài ôn tập hôm nay!', 'en': 'You have completed all review tasks for today!', 'de': 'Du hast alle Wiederholungsaufgaben für heute abgeschlossen!'},
        'completed': {'vi': 'Đã hoàn thành', 'en': 'Completed', 'de': 'Abgeschlossen'},
        'times': {'vi': 'lần', 'en': 'times', 'de': 'Mal'},
        'lastTime': {'vi': 'Lần cuối:', 'en': 'Last time:', 'de': 'Letztes Mal:'}
    }
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'errors' not in data:
        data['errors'] = {}
        
    for key, translations in new_keys['errors'].items():
        data['errors'][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
