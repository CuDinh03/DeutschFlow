import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'history': {
        'noTopic': {'vi': 'Không có chủ đề', 'en': 'No topic', 'de': 'Kein Thema'},
        'messages': {'vi': '{count} tin nhắn', 'en': '{count} messages', 'de': '{count} Nachrichten'},
        'completed': {'vi': 'Hoàn thành', 'en': 'Completed', 'de': 'Abgeschlossen'},
        'open': {'vi': 'Đang mở', 'en': 'Open', 'de': 'Offen'},
        'correction': {'vi': 'Sửa lỗi: ', 'en': 'Correction: ', 'de': 'Korrektur: '},
        'explanation': {'vi': 'Giải thích: ', 'en': 'Explanation: ', 'de': 'Erklärung: '},
        'grammarErrors': {'vi': '{count} lỗi ngữ pháp', 'en': '{count} grammar errors', 'de': '{count} Grammatikfehler'},
        'details': {'vi': 'Chi tiết', 'en': 'Details', 'de': 'Details'},
        'student': {'vi': 'Học viên', 'en': 'Student', 'de': 'Schüler'},
        'replayTitle': {'vi': 'Replay phiên nói', 'en': 'Replay Speaking Session', 'de': 'Sprechsitzung wiederholen'},
        'historyTitle': {'vi': 'Lịch sử luyện nói', 'en': 'Speaking History', 'de': 'Sprechverlauf'},
        'historySubtitle': {'vi': 'Xem lại các buổi hội thoại với AI', 'en': 'Review your AI conversations', 'de': 'Überprüfen Sie Ihre KI-Gespräche'},
        'sessionList': {'vi': 'Danh sách phiên', 'en': 'Session List', 'de': 'Sitzungsliste'},
        'recentSessions': {'vi': '{count} phiên gần đây', 'en': '{count} recent sessions', 'de': '{count} letzte Sitzungen'},
        'startNew': {'vi': 'Bắt đầu phiên mới', 'en': 'Start new session', 'de': 'Neue Sitzung starten'},
        'noSessions': {'vi': 'Chưa có phiên nào', 'en': 'No sessions yet', 'de': 'Noch keine Sitzungen'},
        'promptStart': {'vi': 'Hãy bắt đầu luyện nói với AI!', 'en': 'Start practicing speaking with AI!', 'de': 'Beginnen Sie mit dem KI-Sprechtraining!'},
        'startNow': {'vi': 'Bắt đầu ngay', 'en': 'Start now', 'de': 'Jetzt starten'},
        'noMessages': {'vi': 'Phiên này chưa có tin nhắn nào.', 'en': 'No messages in this session.', 'de': 'Keine Nachrichten in dieser Sitzung.'}
    }
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'history' not in data:
        data['history'] = {}
        
    for key, translations in new_keys['history'].items():
        data['history'][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
