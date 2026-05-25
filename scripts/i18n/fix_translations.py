import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_student_keys = {
    'navGroupLearn': {'vi': 'Học & Khám phá', 'en': 'Learn & Explore', 'de': 'Lernen & Entdecken'},
    'navGroupPractice': {'vi': 'Luyện tập', 'en': 'Practice', 'de': 'Üben'},
    'navGroupReview': {'vi': 'Ôn tập', 'en': 'Review', 'de': 'Wiederholen'},
    'navGroupProfile': {'vi': 'Hồ sơ & Cài đặt', 'en': 'Profile & Settings', 'de': 'Profil & Einstellungen'},
    'navVocabulary': {'vi': 'Tra cứu từ vựng', 'en': 'Vocabulary lookup', 'de': 'Vokabelsuche'},
    'navVocabAnalytics': {'vi': 'Thống kê từ vựng', 'en': 'Vocab Analytics', 'de': 'Vokabel-Statistik'},
    'navGrammarAI': {'vi': 'Luyện ngữ pháp AI', 'en': 'AI Grammar Practice', 'de': 'KI-Grammatik-Übung'},
    'navCurriculum': {'vi': 'Giáo trình A1', 'en': 'A1 Curriculum', 'de': 'A1 Lehrplan'},
    'navSpeakingHistory': {'vi': 'Lịch sử giao tiếp', 'en': 'Speaking History', 'de': 'Sprechverlauf'},
    'navInterviews': {'vi': 'Kết quả phỏng vấn', 'en': 'Interview Results', 'de': 'Interview-Ergebnisse'},
    'navLeaderboard': {'vi': 'Bảng xếp hạng', 'en': 'Leaderboard', 'de': 'Bestenliste'},
    'navBadges': {'vi': 'Huy hiệu', 'en': 'Badges', 'de': 'Abzeichen'},
    'navReviewQueue': {'vi': 'Ôn tập hôm nay', 'en': "Today's Review", 'de': 'Heute wiederholen'},
    'navReviewSrs': {'vi': 'Ôn tập SRS', 'en': 'SRS Review', 'de': 'SRS Wiederholung'}
}

new_roadmap_keys = {
    'subtitle': {'vi': '28 ngày · Goethe A1 Curriculum', 'en': '28 days · Goethe A1 Curriculum', 'de': '28 Tage · Goethe A1 Curriculum'},
    'phase1': {'vi': 'Phase 1 · Ngày 1–14', 'en': 'Phase 1 · Days 1–14', 'de': 'Phase 1 · Tage 1–14'},
    'phase2': {'vi': 'Phase 2 · Ngày 15–28', 'en': 'Phase 2 · Days 15–28', 'de': 'Phase 2 · Tage 15–28'},
    'startFinish': {'vi': 'Hoàn thành', 'en': 'Completed', 'de': 'Abgeschlossen'}
}

for lang, filepath in files.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'student' not in data:
        data['student'] = {}
    for key, translations in new_student_keys.items():
        data['student'][key] = translations[lang]
        
    if 'roadmap' not in data:
        data['roadmap'] = {}
    for key, translations in new_roadmap_keys.items():
        data['roadmap'][key] = translations[lang]
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON files updated successfully!")
