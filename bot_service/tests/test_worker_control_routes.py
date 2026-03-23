import base64
from datetime import timedelta

from core.datetime_utils import utcnow_naive
from models import TTSJob, Worker, WorkerPairingToken


def _activate_worker(client, pairing_code: str, *, supports_f5: bool, supports_qwen: bool, label: str = "Test Worker"):
    response = client.post(
        "/api/worker-agent/activate",
        json={
            "pairing_code": pairing_code,
            "label": label,
            "supports_f5": supports_f5,
            "supports_qwen": supports_qwen,
            "capabilities": {
                "providers": [provider for provider, enabled in (("f5", supports_f5), ("qwen", supports_qwen)) if enabled],
                "runtime": "pytest",
            },
            "runtime_metadata": {"hostname": "pytest-host"},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _poll_worker(client, auth_token: str, *, supports_f5: bool, supports_qwen: bool, wait_for_jobs: bool = False):
    response = client.post(
        "/api/worker-agent/poll",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "max_jobs": 1,
            "wait_for_jobs": wait_for_jobs,
            "supports_f5": supports_f5,
            "supports_qwen": supports_qwen,
            "capabilities": {
                "providers": [provider for provider, enabled in (("f5", supports_f5), ("qwen", supports_qwen)) if enabled]
            },
            "runtime_metadata": {"hostname": "pytest-host"},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_worker_pair_activate_and_complete_job(authenticated_client, db, test_user):
    token_response = authenticated_client.post(
        "/api/tts/workers/pairing-tokens",
        json={"label_hint": "My PC", "provider_hint": "both"},
    )
    assert token_response.status_code == 200, token_response.text
    pairing_code = token_response.json()["pairing_code"]

    activation = _activate_worker(
        authenticated_client,
        pairing_code,
        supports_f5=True,
        supports_qwen=True,
        label="Home PC",
    )
    auth_token = activation["auth_token"]
    worker_key = activation["worker"]["worker_key"]

    list_response = authenticated_client.get("/api/tts/workers")
    assert list_response.status_code == 200, list_response.text
    workers = list_response.json()["workers"]
    assert any(worker["worker_key"] == worker_key for worker in workers)

    job_response = authenticated_client.post(
        "/api/tts/workers/jobs",
        json={
            "provider": "f5",
            "text": "hello from worker control plane",
            "voice": "default_voice",
            "payload": {
                "channel_name": "pytest",
                "author": "pytest",
                "user_id": test_user.id,
                "tts_settings": {"advanced_provider": "f5"},
            },
        },
    )
    assert job_response.status_code == 200, job_response.text
    job_id = job_response.json()["job"]["id"]

    poll_payload = _poll_worker(authenticated_client, auth_token, supports_f5=True, supports_qwen=True)
    jobs = poll_payload["jobs"]
    assert len(jobs) == 1
    assert jobs[0]["id"] == job_id
    assert jobs[0]["provider"] == "f5"

    audio_bytes = b"RIFF\x24\x00\x00\x00WAVEfmt "
    complete_response = authenticated_client.post(
        f"/api/worker-agent/jobs/{job_id}/complete",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
            "content_type": "audio/wav",
            "result_payload": {"duration": 0.1},
        },
    )
    assert complete_response.status_code == 200, complete_response.text

    job_status = authenticated_client.get(f"/api/tts/workers/jobs/{job_id}")
    assert job_status.status_code == 200, job_status.text
    job = job_status.json()["job"]
    assert job["status"] == "completed"
    assert job["result_audio_url"]
    assert job["result_payload"]["provider"] == "f5"

    pairing_token_row = db.query(WorkerPairingToken).first()
    assert pairing_token_row is not None
    assert pairing_token_row.used_at is not None


def test_worker_poll_requeues_expired_jobs(authenticated_client, db):
    pairing_code = authenticated_client.post(
        "/api/tts/workers/pairing-tokens",
        json={"provider_hint": "f5"},
    ).json()["pairing_code"]
    activation = _activate_worker(
        authenticated_client,
        pairing_code,
        supports_f5=True,
        supports_qwen=False,
    )
    auth_token = activation["auth_token"]

    job_response = authenticated_client.post(
        "/api/tts/workers/jobs",
        json={"provider": "f5", "text": "lease expiry test"},
    )
    assert job_response.status_code == 200, job_response.text
    job_id = job_response.json()["job"]["id"]

    first_poll = _poll_worker(authenticated_client, auth_token, supports_f5=True, supports_qwen=False)
    assert len(first_poll["jobs"]) == 1
    assert first_poll["jobs"][0]["attempt_count"] == 1

    job_row = db.query(TTSJob).filter(TTSJob.id == job_id).first()
    assert job_row is not None
    job_row.lease_expires_at = utcnow_naive() - timedelta(seconds=5)
    db.add(job_row)
    db.commit()

    second_poll = _poll_worker(authenticated_client, auth_token, supports_f5=True, supports_qwen=False)
    assert len(second_poll["jobs"]) == 1
    assert second_poll["jobs"][0]["id"] == job_id
    assert second_poll["jobs"][0]["attempt_count"] == 2


def test_provider_specific_worker_only_claims_supported_jobs(authenticated_client):
    pairing_code = authenticated_client.post(
        "/api/tts/workers/pairing-tokens",
        json={"provider_hint": "f5"},
    ).json()["pairing_code"]
    activation = _activate_worker(
        authenticated_client,
        pairing_code,
        supports_f5=True,
        supports_qwen=False,
    )
    auth_token = activation["auth_token"]

    qwen_job = authenticated_client.post(
        "/api/tts/workers/jobs",
        json={"provider": "qwen", "text": "qwen only job"},
    )
    assert qwen_job.status_code == 200, qwen_job.text

    empty_poll = _poll_worker(authenticated_client, auth_token, supports_f5=True, supports_qwen=False)
    assert empty_poll["jobs"] == []

    f5_job = authenticated_client.post(
        "/api/tts/workers/jobs",
        json={"provider": "f5", "text": "f5 job"},
    )
    assert f5_job.status_code == 200, f5_job.text
    f5_job_id = f5_job.json()["job"]["id"]

    poll_payload = _poll_worker(authenticated_client, auth_token, supports_f5=True, supports_qwen=False)
    assert len(poll_payload["jobs"]) == 1
    assert poll_payload["jobs"][0]["id"] == f5_job_id
    assert poll_payload["jobs"][0]["provider"] == "f5"


def test_admin_can_issue_managed_pairing_and_managed_job(admin_client):
    pairing_response = admin_client.post(
        "/api/tts/admin/workers/pairing-tokens",
        json={"label_hint": "Managed Qwen", "provider_hint": "qwen", "is_managed": True},
    )
    assert pairing_response.status_code == 200, pairing_response.text
    pairing_payload = pairing_response.json()
    assert pairing_payload["is_managed"] is True

    activation = _activate_worker(
        admin_client,
        pairing_payload["pairing_code"],
        supports_f5=False,
        supports_qwen=True,
        label="Managed Qwen Worker",
    )
    auth_token = activation["auth_token"]

    job_response = admin_client.post(
        "/api/tts/admin/workers/jobs",
        json={"provider": "qwen", "text": "managed qwen job"},
    )
    assert job_response.status_code == 200, job_response.text
    job_id = job_response.json()["job"]["id"]

    poll_payload = _poll_worker(admin_client, auth_token, supports_f5=False, supports_qwen=True)
    assert len(poll_payload["jobs"]) == 1
    assert poll_payload["jobs"][0]["id"] == job_id
    assert poll_payload["jobs"][0]["provider"] == "qwen"

    workers_response = admin_client.get("/api/tts/admin/workers")
    assert workers_response.status_code == 200, workers_response.text
    workers = workers_response.json()["workers"]
    managed_worker = next(worker for worker in workers if worker["worker_key"] == activation["worker"]["worker_key"])
    assert managed_worker["is_managed"] is True
