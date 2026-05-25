import json
import os

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'nav': {
        'vocabAnalytics': {'vi': 'Thống kê từ vựng', 'en': 'Vocab Analytics', 'de': 'Vokabel-Statistik'},
        'curriculum': {'vi': 'Giáo trình A1', 'en': 'A1 Curriculum', 'de': 'A1 Lehrplan'},
        'grammarAI': {'vi': 'Luyện ngữ pháp AI', 'en': 'AI Grammar Practice', 'de': 'KI Grammatik-Training'},
        'dashboard': {'vi': 'Dashboard', 'en': 'Dashboard', 'de': 'Dashboard'},
        'errorStats': {'vi': 'Thống kê lỗi', 'en': 'Error Statistics', 'de': 'Fehlerstatistik'},
        'store': {'vi': 'Cửa hàng', 'en': 'Store', 'de': 'Shop'}
    },
    'roadmap': {
        'title': {'vi': 'Lộ trình học tập', 'en': 'Learning Path', 'de': 'Lernpfad'},
        'tree': {'vi': 'Cây', 'en': 'Tree', 'de': 'Baum'},
        'list': {'vi': 'Danh sách', 'en': 'List', 'de': 'Liste'},
        'currentPosition': {'vi': 'Vị trí đang học', 'en': 'Current Position', 'de': 'Aktuelle Position'},
        'continueLearning': {'vi': 'Tiếp tục học', 'en': 'Continue Learning', 'de': 'Weiterlernen'},
        'all': {'vi': 'Toàn bộ', 'en': 'All', 'de': 'Alle'},
        'noData': {'vi': 'Chưa có bài tập', 'en': 'No exercises', 'de': 'Keine Übungen'},
        'scrollHint': {'vi': 'Scroll để zoom - Kéo để di chuyển - Click node để học', 'en': 'Scroll to zoom - Drag to move - Click node to learn', 'de': 'Scrollen zum Zoomen - Ziehen zum Bewegen - Klicken zum Lernen'},
        'phase': {'vi': 'Giai đoạn', 'en': 'Phase', 'de': 'Phase'},
        'day': {'vi': 'Ngày', 'en': 'Day', 'de': 'Tag'},
        'openAfter': {'vi': 'Mở sau Ngày', 'en': 'Opens after Day', 'de': 'Öffnet nach Tag'}
    },
    'learn': {
        'completed100': {'vi': 'Đã hoàn thành 100%', 'en': '100% Completed', 'de': '100% Abgeschlossen'},
        'readAndUnderstood': {'vi': 'Đã đọc & Hiểu (100%)', 'en': 'Read & Understood (100%)', 'de': 'Gelesen & Verstanden (100%)'},
        'tapToRecord': {'vi': 'Nhấn để thu âm', 'en': 'Tap to record', 'de': 'Tippen zum Aufnehmen'},
        'noExerciseData': {'vi': 'Chưa có dữ liệu bài tập', 'en': 'No exercise data', 'de': 'Keine Übungsdaten'},
        'lesson': {'vi': 'Bài học', 'en': 'Lesson', 'de': 'Lektion'},
        'loading': {'vi': 'Đang tải...', 'en': 'Loading...', 'de': 'Lädt...'}
    },
    'analytics': {
        'title': {'vi': 'Thống kê từ vựng', 'en': 'Vocabulary Analytics', 'de': 'Vokabel-Statistik'},
        'cannotLoad': {'vi': 'Không thể tải dữ liệu thống kê.', 'en': 'Cannot load analytics data.', 'de': 'Statistikdaten konnten nicht geladen werden.'}
    },
    'history': {
        'notDone': {'vi': 'Chưa xong', 'en': 'Incomplete', 'de': 'Unvollständig'},
        'completed': {'vi': 'Đã xong', 'en': 'Completed', 'de': 'Abgeschlossen'},
        'open': {'vi': 'Đang mở', 'en': 'Open', 'de': 'Offen'},
        'noRecords': {'vi': 'Không có lịch sử.', 'en': 'No history records.', 'de': 'Keine Historie vorhanden.'}
    },
    'curriculum': {
        'cannotLoad': {'vi': 'Không thể tải nội dung giáo trình.', 'en': 'Cannot load curriculum content.', 'de': 'Lehrplaninhalte konnten nicht geladen werden.'},
        'content': {'vi': 'Nội dung giáo trình', 'en': 'Curriculum Content', 'de': 'Lehrplaninhalte'},
        'title': {'vi': 'Giáo trình Netzwerk Neu A1', 'en': 'Netzwerk Neu A1 Curriculum', 'de': 'Netzwerk Neu A1 Lehrplan'},
        'loading': {'vi': 'Đang tải giáo trình...', 'en': 'Loading curriculum...', 'de': 'Lehrplan lädt...'},
        'noData': {'vi': 'Chưa có dữ liệu giáo trình.', 'en': 'No curriculum data.', 'de': 'Keine Lehrplandaten.'}
    }
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for namespace, keys in new_keys.items():
        if namespace not in data:
            data[namespace] = {}
        for key, translations in keys.items():
            if key not in data[namespace]: # Do not overwrite if exists
                data[namespace][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
