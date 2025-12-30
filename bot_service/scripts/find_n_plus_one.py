#!/usr/bin/env python3
# bot_service/scripts/find_n_plus_one.py
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

# Add bot_service to path
BOT_SERVICE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BOT_SERVICE_ROOT))

from sqlalchemy import event
from sqlalchemy.engine import Engine
from core.database import engine, SessionLocal
from models import User, UserToken, TTSUserSettings, YouTubeQueue, DropsHistory

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Query tracking
query_log = []
query_counts = defaultdict(int)


@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Log all SQL queries"""
    # Normalize query (remove specific IDs)
    normalized = re.sub(r'\d+', 'N', statement)
    normalized = re.sub(r"'[^']*'", "'X'", normalized)
    
    query_log.append({
        'query': statement,
        'normalized': normalized,
        'parameters': parameters
    })
    query_counts[normalized] += 1


def analyze_queries():
    """Analyze queries for N+1 patterns"""
    logger.info("\n" + "="*80)
    logger.info("QUERY ANALYSIS")
    logger.info("="*80)
    
    # Find repeated queries
    repeated = {q: count for q, count in query_counts.items() if count > 5}
    
    if repeated:
        logger.warning(f"\n⚠️  Found {len(repeated)} potentially problematic query patterns:\n")
        
        for query, count in sorted(repeated.items(), key=lambda x: x[1], reverse=True):
            logger.warning(f"Executed {count} times:")
            logger.warning(f"  {query[:200]}...\n")
    else:
        logger.info("✅ No obvious N+1 query patterns detected")
    
    logger.info(f"\nTotal queries executed: {len(query_log)}")
    logger.info(f"Unique query patterns: {len(query_counts)}")


def test_admin_users_list():
    """Test /api/admin/users/list endpoint simulation"""
    logger.info("\n" + "-"*80)
    logger.info("Testing: Admin Users List (simulated)")
    logger.info("-"*80)
    
    query_log.clear()
    query_counts.clear()
    
    db = SessionLocal()
    try:
        # Simulate getting users with their tokens
        users = db.query(User).limit(10).all()
        
        # ❌ BAD: N+1 query - accessing tokens for each user
        for user in users:
            tokens = user.tokens  # This triggers a separate query!
            logger.debug(f"User {user.id} has {len(tokens)} tokens")
        
        analyze_queries()
        
    finally:
        db.close()


def test_admin_users_list_optimized():
    """Test optimized version with eager loading"""
    logger.info("\n" + "-"*80)
    logger.info("Testing: Admin Users List (OPTIMIZED)")
    logger.info("-"*80)
    
    query_log.clear()
    query_counts.clear()
    
    db = SessionLocal()
    try:
        from sqlalchemy.orm import joinedload
        
        # ✅ GOOD: Eager loading - single query with JOIN
        users = db.query(User).options(
            joinedload(User.tokens)
        ).limit(10).all()
        
        for user in users:
            tokens = user.tokens  # No additional query!
            logger.debug(f"User {user.id} has {len(tokens)} tokens")
        
        analyze_queries()
        
    finally:
        db.close()


def test_tts_voices():
    """Test TTS voices endpoint simulation"""
    logger.info("\n" + "-"*80)
    logger.info("Testing: TTS Voices List")
    logger.info("-"*80)
    
    query_log.clear()
    query_counts.clear()
    
    db = SessionLocal()
    try:
        # Get TTS settings for users
        settings = db.query(TTSUserSettings).limit(10).all()
        
        for setting in settings:
            user = setting.user  # Potential N+1 if not eager loaded
            logger.debug(f"User {user.id if user else 'None'} TTS settings")
        
        analyze_queries()
        
    finally:
        db.close()


def test_youtube_queue():
    """Test YouTube queue endpoint simulation"""
    logger.info("\n" + "-"*80)
    logger.info("Testing: YouTube Queue")
    logger.info("-"*80)
    
    query_log.clear()
    query_counts.clear()
    
    db = SessionLocal()
    try:
        # Get YouTube queue with users
        queue = db.query(YouTubeQueue).filter(
            YouTubeQueue.status == 'pending'
        ).limit(20).all()
        
        for item in queue:
            user = item.user  # Potential N+1
            logger.debug(f"Video by {user.twitch_username if user else 'Unknown'}")
        
        analyze_queries()
        
    finally:
        db.close()


def test_drops_history():
    """Test Drops history endpoint simulation"""
    logger.info("\n" + "-"*80)
    logger.info("Testing: Drops History")
    logger.info("-"*80)
    
    query_log.clear()
    query_counts.clear()
    
    db = SessionLocal()
    try:
        # Get drops history with users
        history = db.query(DropsHistory).limit(20).all()
        
        for drop in history:
            user = drop.user  # Potential N+1
            reward = drop.reward  # Potential N+1
            logger.debug(f"Drop for user {user.id if user else 'None'}")
        
        analyze_queries()
        
    finally:
        db.close()


def generate_recommendations():
    """Generate recommendations for fixing N+1 queries"""
    logger.info("\n" + "="*80)
    logger.info("RECOMMENDATIONS")
    logger.info("="*80)
    
    recommendations = """
    
To fix N+1 queries, use eager loading with joinedload or selectinload:

1. For One-to-Many relationships (User -> Tokens):
   
   from sqlalchemy.orm import joinedload
   
   users = db.query(User).options(
       joinedload(User.tokens)
   ).all()

2. For Many-to-One relationships (YouTubeQueue -> User):
   
   queue = db.query(YouTubeQueue).options(
       joinedload(YouTubeQueue.user)
   ).all()

3. For multiple relationships:
   
   users = db.query(User).options(
       joinedload(User.tokens),
       joinedload(User.tts_settings),
       joinedload(User.user_settings)
   ).all()

4. Use selectinload for large collections:
   
   from sqlalchemy.orm import selectinload
   
   users = db.query(User).options(
       selectinload(User.tokens)
   ).all()

Critical endpoints to fix:
- /api/admin/users/list - Add joinedload(User.tokens)
- /api/tts/voices - Add joinedload(TTSUserSettings.user)
- /api/youtube/queue - Add joinedload(YouTubeQueue.user)
- /api/drops/history - Add joinedload(DropsHistory.user, DropsHistory.reward)
"""
    
    logger.info(recommendations)


def main():
    """Run all N+1 detection tests"""
    logger.info("="*80)
    logger.info("N+1 QUERY DETECTOR")
    logger.info("="*80)
    
    # Test problematic patterns
    test_admin_users_list()
    
    # Test optimized version
    test_admin_users_list_optimized()
    
    # Test other endpoints
    test_tts_voices()
    test_youtube_queue()
    test_drops_history()
    
    # Generate recommendations
    generate_recommendations()
    
    logger.info("\n" + "="*80)
    logger.info("ANALYSIS COMPLETE")
    logger.info("="*80)


if __name__ == "__main__":
    main()
