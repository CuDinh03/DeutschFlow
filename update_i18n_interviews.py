import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'history': {
        'unknownPosition': {'vi': 'Vị trí không xác định', 'en': 'Unknown position', 'de': 'Unbekannte Position'},
        'turns': {'vi': '{count} lượt trao đổi', 'en': '{count} turns', 'de': '{count} Runden'},
        'hrRole': {'vi': 'HR: {persona}', 'en': 'HR: {persona}', 'de': 'HR: {persona}'},
        'completed': {'vi': 'Đã xong', 'en': 'Completed', 'de': 'Abgeschlossen'},
        'incomplete': {'vi': 'Chưa hoàn thành', 'en': 'Incomplete', 'de': 'Unvollständig'},
        'closeReport': {'vi': 'Đóng báo cáo', 'en': 'Close report', 'de': 'Bericht schließen'},
        'interviewsTitle': {'vi': 'Kết quả phỏng vấn', 'en': 'Interview Results', 'de': 'Interview-Ergebnisse'},
        'interviewsSubtitle': {'vi': 'Xem lại kết quả các buổi phỏng vấn giả lập', 'en': 'Review mock interview results', 'de': 'Überprüfen Sie Mock-Interview-Ergebnisse'},
        'interviewCount': {'vi': '{count} phiên phỏng vấn', 'en': '{count} interview sessions', 'de': '{count} Interviewsitzungen'},
        'newInterview': {'vi': 'Phỏng vấn mới', 'en': 'New interview', 'de': 'Neues Interview'},
        'noInterviews': {'vi': 'Chưa có kết quả phỏng vấn nào', 'en': 'No interview results yet', 'de': 'Noch keine Interviewergebnisse'},
        'promptInterview': {'vi': 'Hãy tham gia một buổi phỏng vấn giả lập!', 'en': 'Participate in a mock interview!', 'de': 'Nehmen Sie an einem Mock-Interview teil!'}
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
