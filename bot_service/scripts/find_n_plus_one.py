#!/usr/bin/env python3
"""
N+1 Query Detector

This script helps identify N+1 query problems by:
1. Enabling SQL query logging
2. Running common API endpoints
3. Analyzing query patterns
4. Reporting potential N+1 issues

Usage:
    python scripts/find_n_plus_one.py
"""
import sys
import logging
import re
from collections import defaultdict
from pathlib import Path
BOT_SERVICE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BOT_SERVICE_ROOT))
from sqlalchemy import event
from sqlalchemy.engine import Engine
from core.database import SessionLocal
from models import User, TTSUserSettings, YouTubeQueue, DropsHistory
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
query_log = []
query_counts = defaultdict(int)

@event.listens_for(Engine, 'before_cursor_execute')
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Log all SQL queries"""
    normalized = re.sub('\\d+', 'N', statement)
    normalized = re.sub("'[^']*'", "'X'", normalized)
    query_log.append({'query': statement, 'normalized': normalized, 'parameters': parameters})
    query_counts[normalized] += 1

def analyze_queries():
    """Analyze queries for N+1 patterns"""
    logger.info('\n' + '=' * 80)
    logger.info('QUERY ANALYSIS')
    logger.info('=' * 80)
    repeated = {q: count for (q, count) in query_counts.items() if count > 5}
    if repeated:
        logger.warning(f'Text cleaned.{len(repeated)} potentially problematic query patterns:\n')
        for (query, count) in sorted(repeated.items(), key=lambda x: x[1], reverse=True):
            logger.warning(f'Executed {count} times:')
            logger.warning(f'  {query[:200]}...\n')
    else:
        logger.info(' No obvious N+1 query patterns detected')
    logger.info(f'\nTotal queries executed: {len(query_log)}')
    logger.info(f'Unique query patterns: {len(query_counts)}')

def test_admin_users_list():
    """Test /api/admin/users/list endpoint simulation"""
    logger.info('\n' + '-' * 80)
    logger.info('Testing: Admin Users List (simulated)')
    logger.info('-' * 80)
    query_log.clear()
    query_counts.clear()
    db = SessionLocal()
    try:
        users = db.query(User).limit(10).all()
        for user in users:
            tokens = user.tokens
            logger.debug(f'User {user.id} has {len(tokens)} tokens')
        analyze_queries()
    finally:
        db.close()

def test_admin_users_list_optimized():
    """Test optimized version with eager loading"""
    logger.info('\n' + '-' * 80)
    logger.info('Testing: Admin Users List (OPTIMIZED)')
    logger.info('-' * 80)
    query_log.clear()
    query_counts.clear()
    db = SessionLocal()
    try:
        from sqlalchemy.orm import joinedload
        users = db.query(User).options(joinedload(User.tokens)).limit(10).all()
        for user in users:
            tokens = user.tokens
            logger.debug(f'User {user.id} has {len(tokens)} tokens')
        analyze_queries()
    finally:
        db.close()

def test_tts_voices():
    """Test TTS voices endpoint simulation"""
    logger.info('\n' + '-' * 80)
    logger.info('Testing: TTS Voices List')
    logger.info('-' * 80)
    query_log.clear()
    query_counts.clear()
    db = SessionLocal()
    try:
        settings = db.query(TTSUserSettings).limit(10).all()
        for setting in settings:
            user = setting.user
            logger.debug(f"User {(user.id if user else 'None')} TTS settings")
        analyze_queries()
    finally:
        db.close()

def test_youtube_queue():
    """Test YouTube queue endpoint simulation"""
    logger.info('\n' + '-' * 80)
    logger.info('Testing: YouTube Queue')
    logger.info('-' * 80)
    query_log.clear()
    query_counts.clear()
    db = SessionLocal()
    try:
        queue = db.query(YouTubeQueue).filter(YouTubeQueue.status == 'pending').limit(20).all()
        for item in queue:
            user = item.user
            logger.debug(f"Video by {(user.twitch_username if user else 'Unknown')}")
        analyze_queries()
    finally:
        db.close()

def test_drops_history():
    """Test Drops history endpoint simulation"""
    logger.info('\n' + '-' * 80)
    logger.info('Testing: Drops History')
    logger.info('-' * 80)
    query_log.clear()
    query_counts.clear()
    db = SessionLocal()
    try:
        history = db.query(DropsHistory).limit(20).all()
        for drop in history:
            user = drop.user
            logger.debug(f"Drop for user {(user.id if user else 'None')}")
        analyze_queries()
    finally:
        db.close()

def generate_recommendations():
    """Generate recommendations for fixing N+1 queries"""
    logger.info('\n' + '=' * 80)
    logger.info('RECOMMENDATIONS')
    logger.info('=' * 80)
    recommendations = '\n    \nTo fix N+1 queries, use eager loading with joinedload or selectinload:\n\n1. For One-to-Many relationships (User -> Tokens):\n   \n   from sqlalchemy.orm import joinedload\n   \n   users = db.query(User).options(\n       joinedload(User.tokens)\n   ).all()\n\n2. For Many-to-One relationships (YouTubeQueue -> User):\n   \n   queue = db.query(YouTubeQueue).options(\n       joinedload(YouTubeQueue.user)\n   ).all()\n\n3. For multiple relationships:\n   \n   users = db.query(User).options(\n       joinedload(User.tokens),\n       joinedload(User.tts_settings),\n       joinedload(User.user_settings)\n   ).all()\n\n4. Use selectinload for large collections:\n   \n   from sqlalchemy.orm import selectinload\n   \n   users = db.query(User).options(\n       selectinload(User.tokens)\n   ).all()\n\nCritical endpoints to fix:\n- /api/admin/users/list - Add joinedload(User.tokens)\n- /api/tts/voices - Add joinedload(TTSUserSettings.user)\n- /api/youtube/queue - Add joinedload(YouTubeQueue.user)\n- /api/drops/history - Add joinedload(DropsHistory.user, DropsHistory.reward)\n'
    logger.info(recommendations)

def main():
    """Run all N+1 detection tests"""
    logger.info('=' * 80)
    logger.info('N+1 QUERY DETECTOR')
    logger.info('=' * 80)
    test_admin_users_list()
    test_admin_users_list_optimized()
    test_tts_voices()
    test_youtube_queue()
    test_drops_history()
    generate_recommendations()
    logger.info('\n' + '=' * 80)
    logger.info('ANALYSIS COMPLETE')
    logger.info('=' * 80)
if __name__ == '__main__':
    main()
