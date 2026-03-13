from models import User
from models.youtube import YouTubeQueue
from services.youtube.queue_service import QueueService


def _queue_item(
    *,
    user_id: int | None = None,
    session_id: str | None = None,
    video_id: str,
    title: str,
    position: int,
    status: str = "pending",
) -> YouTubeQueue:
    return YouTubeQueue(
        user_id=user_id,
        session_id=session_id,
        video_url=f"https://www.youtube.com/watch?v={video_id}",
        video_id=video_id,
        title=title,
        channel_name="queue_owner",
        platform="twitch",
        requester_name="tester",
        requester_id="tester",
        position=position,
        status=status,
    )


def test_get_user_queue_returns_only_pending_items_for_user(db, test_user):
    other_user = User(twitch_username="other_queue_owner", role="user", is_active=True)
    db.add(other_user)
    db.commit()
    db.refresh(other_user)

    db.add_all(
        [
            _queue_item(user_id=test_user.id, video_id="userpending1", title="User Pending 1", position=1),
            _queue_item(
                user_id=test_user.id,
                video_id="userplayed1",
                title="User Played",
                position=2,
                status="played",
            ),
            _queue_item(user_id=other_user.id, video_id="otherpending1", title="Other Pending", position=1),
        ]
    )
    db.commit()

    queue = QueueService().get_user_queue(test_user.id, db=db)

    assert [item["video_id"] for item in queue] == ["userpending1"]


def test_get_queue_supports_legacy_positional_db_argument(db, test_user):
    db.add(
        _queue_item(
            user_id=test_user.id,
            video_id="legacycompat1",
            title="Legacy Compat Queue",
            position=1,
        )
    )
    db.commit()

    queue = QueueService().get_queue(test_user.id, db)

    assert len(queue) == 1
    assert queue[0]["video_id"] == "legacycompat1"
