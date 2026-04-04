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


def test_reorder_queue_items_rebuilds_positions_around_current_video(db, test_user):
    current_item = _queue_item(
        user_id=test_user.id,
        video_id="currentvideo1",
        title="Current Video",
        position=1,
    )
    second_item = _queue_item(
        user_id=test_user.id,
        video_id="nextvideo2",
        title="Next Video",
        position=2,
    )
    third_item = _queue_item(
        user_id=test_user.id,
        video_id="latervideo3",
        title="Later Video",
        position=3,
    )
    db.add_all([current_item, second_item, third_item])
    db.commit()
    db.refresh(current_item)
    db.refresh(second_item)
    db.refresh(third_item)

    success = QueueService().reorder_queue_items(
        test_user.id,
        third_item.id,
        second_item.id,
        db=db,
    )

    assert success is True

    reordered_items = (
        db.query(YouTubeQueue)
        .filter(YouTubeQueue.user_id == test_user.id, YouTubeQueue.status == "pending")
        .order_by(YouTubeQueue.position.asc())
        .all()
    )

    assert [item.video_id for item in reordered_items] == [
        "currentvideo1",
        "latervideo3",
        "nextvideo2",
    ]
    assert [item.position for item in reordered_items] == [1, 2, 3]


def test_reorder_queue_api_updates_pending_order(authenticated_client, db, test_user):
    current_item = _queue_item(
        user_id=test_user.id,
        video_id="api_current_1",
        title="API Current",
        position=1,
    )
    second_item = _queue_item(
        user_id=test_user.id,
        video_id="api_second_2",
        title="API Second",
        position=2,
    )
    third_item = _queue_item(
        user_id=test_user.id,
        video_id="api_third_3",
        title="API Third",
        position=3,
    )
    db.add_all([current_item, second_item, third_item])
    db.commit()
    db.refresh(second_item)
    db.refresh(third_item)

    response = authenticated_client.post(
        "/api/youtube/queue/reorder",
        json={
            "active_queue_id": third_item.id,
            "over_queue_id": second_item.id,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True

    reordered_items = (
        db.query(YouTubeQueue)
        .filter(YouTubeQueue.user_id == test_user.id, YouTubeQueue.status == "pending")
        .order_by(YouTubeQueue.position.asc())
        .all()
    )

    assert [item.video_id for item in reordered_items] == [
        "api_current_1",
        "api_third_3",
        "api_second_2",
    ]
