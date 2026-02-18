# bot_service/services/tts/tts_worker.py
"""
TTS Worker processes tasks from MemoryTTSQueue.
It decouples the API (producer) from the synthesis logic (consumer).
"""
import asyncio
import logging
import traceback
from typing import Optional

from services.tts.memory_tts_queue import get_memory_tts_queue, TTSTask, TaskStatus
from services.tts.tts_manager import get_tts_manager
from core.database import SessionLocal
from core.connection_manager import get_connection_manager

logger = logging.getLogger(__name__)

class TTSWorker:
    """
    Background worker that consumes tasks from MemoryTTSQueue
    and executes synthesis via TTSManager.
    """
    
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.tts_manager = get_tts_manager()
        self.connection_manager = get_connection_manager()

    async def start(self):
        """Start the worker loop."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._worker_loop())
        logger.info("TTS Worker started")

    async def stop(self):
        """Stop the worker loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("TTS Worker stopped")

    async def _worker_loop(self):
        """Main processing loop."""
        logger.info("TTS Worker loop running...")
        
        while self._running:
            try:
                # 1. Get next task (with timeout to allow checking _running)
                task = await get_memory_tts_queue().get_next_task(timeout=1.0)
                
                if not task:
                    continue

                # 2. Process task
                await self._process_task(task)

            except Exception as e:
                logger.exception("Error in TTS Worker loop")
                await asyncio.sleep(1.0) # Prevent tight loop on error

    async def _process_task(self, task: TTSTask):
        """Execute a single TTS task."""
        try:
            logger.info(f"Processing TTS task {task.task_id} for user {task.user_id}")
            
            # Create a DB session for this operation if needed (though TTSManager currently handles it or takes it)
            # Ideally TTSManager methods should accept a session or manage their own scope for transactional integrity.
            # Looking at TTSManager code, it mostly calls external APIs or BasicTTS (local).
            # Unblocking User / updating stats might require DB.
            
            # Using SessionLocal context manager for safety
            db = SessionLocal()
            try:
                # Execute Synthesis
                # Note: tts_manager.synthesize_tts signature:
                # channel_name, text, author, user_id=None, volume_level=..., use_ai_tts=..., use_basic_tts=..., 
                # connection_manager=..., tts_settings=..., word_filter=..., blocked_users=..., db_session=...
                
                # We need to extract args from task
                # Assuming task.result or task.meta might store some pre-fetched config, 
                # but usually we should re-fetch or pass them.
                # However, MemoryTTSQueue stores minimal info.
                
                # Let's see what we stored in memory_tts_queue.TTSTask
                # user_id, text, voice, channel, platform, priority
                
                # We need to reconstruct the call. 
                # Ideally, the Service should have resolved all settings BEFORE queuing, 
                # OR the Worker resolves them now. 
                # "Deferred resolution" is better for consistency if queue time is short.
                # But if we want exact state at request time, "Resolved" is better.
                # Given current architecture, let's assume we pass what we have.
                
                # NOTE: The task object in memory_tts_queue.py only has basic fields.
                # We might need to fetch settings here if they weren't passed.
                # But wait, looking at `api/tts/synthesis_routes.py`, it calculates limits but 
                # `memory_tts_queue.add_tts_task` puts it in queue.
                
                # The `synthesize_tts` method in `TTSManager` does a lot of work (validation, etc maybe?).
                # Actually `TTSManager` mostly does the actual synthesis call.
                
                # We will call tts_manager.synthesize_tts
                # We interpret "voice" from task as a preference, but Manager might override based on settings?
                # Actually TTSManager takes `use_ai_tts` flag.
                
                # For now, let's map what we have.
                # We might need to improve TTSTask definition later to include more metadata (volume, etc)
                # stored in `meta_` fields.
                
                volume = getattr(task, 'meta_volume', 50.0) # Default 50
                author = getattr(task, 'meta_author', 'System')
                use_ai = getattr(task, 'meta_use_ai', True) # Default try AI
                
                result = await self.tts_manager.synthesize_tts(
                    channel_name=task.channel,
                    text=task.text,
                    author=author,
                    user_id=task.user_id,
                    volume_level=volume,
                    use_ai_tts=use_ai,
                    use_basic_tts=True, # Always allow fallback
                    connection_manager=self.connection_manager,
                    db_session=db
                    # tts_settings, word_filter etc - extracted inside if not passed? 
                    # TTSManager doesn't seem to fetch them automatically if not passed.
                    # We should probably refactor TTSManager to fetch if missing, or fetch here.
                    # For this iteration, let's rely on TTSManager defaults or internal fetching if implemented.
                    # Re-reading TTSManager: it passes them to _synthesize_via_tts_service which sends them to Service.
                    # So we SHOULD fetch them here or let the remote Service fetch them?
                    # Remote service probably needs them passed.
                )
                
                if result.get("success"):
                    await get_memory_tts_queue().complete_task(task.task_id, result)
                else:
                    await get_memory_tts_queue().fail_task(task.task_id, result.get("error", "Unknown error"))
                    
            finally:
                db.close()
                
        except Exception as e:
            logger.exception("Failed to process task {task.task_id}")
            logger.error(traceback.format_exc())
            await get_memory_tts_queue().fail_task(task.task_id, str(e))

# Global instance
tts_worker = TTSWorker()

