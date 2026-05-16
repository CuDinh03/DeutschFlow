import json

files = {
    'vi': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/vi.json',
    'en': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/en.json',
    'de': '/Users/dinhcu/Desktop/DeutschFlow/frontend/messages/de.json'
}

new_keys = {
    'learn': {
        'speakingSuccess': {'vi': 'Đã hoàn thành phần Nói (≥ 80% bài đạt điểm cao)', 'en': 'Speaking section completed (≥ 80% high scores)', 'de': 'Sprechbereich abgeschlossen (≥ 80% hohe Punktzahl)'},
        'listeningSuccess': {'vi': 'Đã hoàn thành phần Nghe (≥ 80% đúng)', 'en': 'Listening section completed (≥ 80% correct)', 'de': 'Hörbereich abgeschlossen (≥ 80% richtig)'},
        'completed': {'vi': 'Đã hoàn thành', 'en': 'Completed', 'de': 'Abgeschlossen'},
        'listenedAndUnderstood': {'vi': 'Đã Nghe & Hiểu (100%)', 'en': 'Listened & Understood (100%)', 'de': 'Gehört & Verstanden (100%)'}
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
