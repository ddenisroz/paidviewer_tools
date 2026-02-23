#!/usr/bin/env python3
"""Text cleaned."""
import sys
import os
from datetime import datetime
import shutil
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from core.database import SessionLocal, User, UserToken, TTSUserSettings, AudioSettings, LocalTTSEndpoint, FilteredWord, TTSBlockedUser, UserSession

def create_backup():
    """Создает резервную копию базы данных"""
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'app_data.db')
    if not os.path.exists(db_path):
        print(f'[WARN] База данных не найдена: {db_path}')
        print(f'   Ожидаемый путь: {os.path.abspath(db_path)}')
        return None
    backup_dir = os.path.join(os.path.dirname(__file__), '..', 'backups', 'database')
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(backup_dir, f'app_data_backup_{timestamp}.db')
    try:
        shutil.copy2(db_path, backup_path)
        file_size = os.path.getsize(backup_path)
        print(f'[OK] Резервная копия создана: {backup_path}')
        print(f'   Размер: {file_size / 1024:.2f} KB')
        return backup_path
    except Exception as e:
        print(f'[ERROR] Ошибка создания резервной копии: {e}')
        return None

def show_database_stats(db):
    """Показывает статистику базы данных"""
    print('\n' + '=' * 60)
    print('Text cleaned.')
    print('=' * 60)
    stats = {'Пользователи (users)': db.query(User).count(), 'Токены (user_tokens)': db.query(UserToken).count(), 'Настройки TTS (tts_user_settings)': db.query(TTSUserSettings).count(), 'Настройки аудио (audio_settings)': db.query(AudioSettings).count(), 'Локальные TTS (local_tts_endpoints)': db.query(LocalTTSEndpoint).count(), 'Фильтры слов (filtered_words)': db.query(FilteredWord).count(), 'Заблокированные (tts_blocked_users)': db.query(TTSBlockedUser).count(), 'Сессии (user_sessions)': db.query(UserSession).count()}
    total = sum(stats.values())
    for (table_name, count) in stats.items():
        print(f'Text cleaned.{table_name:<40} {count:>5} записей')
    print('-' * 60)
    print(f'Text cleaned.{total}')
    print('=' * 60)
    return stats

def cleanup_users(db, keep_admins=True):
    """Удаляет всех пользователей и связанные данные"""
    print('\n[DELETE]  Начинаем очистку...\n')
    deleted_counts = {}
    if keep_admins:
        users_to_delete = db.query(User).filter(not User.is_admin).all()
        print('[LIST] Удаление пользователей (сохраняем админов)...')
    else:
        users_to_delete = db.query(User).all()
        print('[LIST] Удаление ВСЕХ пользователей (включая админов)...')
    user_ids = [user.id for user in users_to_delete]
    if not user_ids:
        print('[INFO]  Нет пользователей для удаления')
        return deleted_counts
    print(f'   Найдено пользователей: {len(user_ids)}')
    print('\n[LINK] Удаление связанных данных...')
    deleted = db.query(UserToken).filter(UserToken.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['user_tokens'] = deleted
    print(f'Text cleaned.{deleted}')
    deleted = db.query(TTSUserSettings).filter(TTSUserSettings.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['tts_user_settings'] = deleted
    print(f'Text cleaned.{deleted}')
    deleted = db.query(AudioSettings).filter(AudioSettings.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['audio_settings'] = deleted
    print(f'Text cleaned.{deleted}')
    deleted = db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['local_tts_endpoints'] = deleted
    print(f'Text cleaned.{deleted}')
    deleted = db.query(FilteredWord).filter(FilteredWord.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['filtered_words'] = deleted
    print(f'Text cleaned.{deleted}')
    deleted = db.query(TTSBlockedUser).filter(TTSBlockedUser.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['tts_blocked_users'] = deleted
    print(f'Text cleaned.{deleted}')
    deleted = db.query(UserSession).filter(UserSession.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['user_sessions'] = deleted
    print(f'Text cleaned.{deleted}')
    print('\n Удаление пользователей...')
    for user in users_to_delete:
        display_name = user.twitch_username or user.vk_username or f'user_{user.id}'
        is_admin = ' (ADMIN)' if user.is_admin else ''
        print(f'Text cleaned.{display_name}{is_admin} (ID: {user.id})')
        db.delete(user)
    deleted_counts['users'] = len(users_to_delete)
    db.commit()
    print(f'\n[OK] Удалено пользователей: {len(users_to_delete)}')
    return deleted_counts

def main():
    print('\n' + '=' * 60)
    print('Text cleaned.')
    print('=' * 60)
    db = SessionLocal()
    try:
        stats_before = show_database_stats(db)
        if stats_before['Пользователи (users)'] == 0:
            print('\n[OK] База данных уже пуста!')
            return
        print('Text cleaned.')
        print('    Перед очисткой будет создана резервная копия базы данных.')
        print('\nВыберите режим:')
        print('Text cleaned.')
        print('  2. Удалить ВСЕХ пользователей (включая админов)')
        print('  0. Отмена')
        choice = input('\nВаш выбор (0/1/2): ').strip()
        if choice == '0':
            print('\n[ERROR] Операция отменена пользователем')
            return
        if choice not in ['1', '2']:
            print('\n[ERROR] Неверный выбор!')
            return
        keep_admins = choice == '1'
        print('\n[PACKAGE] Создание резервной копии...')
        backup_path = create_backup()
        if not backup_path:
            print('[ERROR] Не удалось создать резервную копию. Операция отменена.')
            return
        confirm = input("\n[WARN]  Вы уверены? Введите 'YES' для подтверждения: ").strip()
        if confirm != 'YES':
            print('\n[ERROR] Операция отменена')
            return
        deleted_counts = cleanup_users(db, keep_admins=keep_admins)
        print('\n' + '=' * 60)
        print('Text cleaned.')
        print('=' * 60)
        total_deleted = sum(deleted_counts.values())
        for (table_name, count) in deleted_counts.items():
            print(f'Text cleaned.{table_name:<40} {count:>5} удалено')
        print('-' * 60)
        print(f'Text cleaned.{total_deleted}')
        print('=' * 60)
        show_database_stats(db)
        print('\n[OK] Очистка завершена успешно!')
        print(f'[PACKAGE] Резервная копия сохранена: {backup_path}')
    except Exception as e:
        print(f'\n[ERROR] Ошибка при очистке базы данных: {e}')
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()
if __name__ == '__main__':
    main()
