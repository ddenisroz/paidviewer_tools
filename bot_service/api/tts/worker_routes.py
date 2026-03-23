"""Backend-only worker control-plane routes for F5 and Qwen agents."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth.auth import get_admin_user, get_current_user
from core.config import settings
from core.database import get_db
from services.worker_control.service import (
    WorkerAuthError,
    WorkerConflictError,
    WorkerControlPlaneError,
    WorkerControlPlaneService,
    WorkerNotFoundError,
    WorkerPermissionError,
    WorkerValidationError,
)


logger = logging.getLogger("bot_service.tts.worker_control")

worker_router = APIRouter(prefix="/api/tts", tags=["tts-workers"])
worker_agent_router = APIRouter(prefix="/api/worker-agent", tags=["worker-agent"])


class PairingTokenRequest(BaseModel):
    label_hint: Optional[str] = Field(default=None, max_length=120)
    provider_hint: Optional[str] = Field(default=None, max_length=16)


class AdminPairingTokenRequest(PairingTokenRequest):
    owner_user_id: Optional[int] = None
    is_managed: bool = True


class ManualWorkerJobRequest(BaseModel):
    provider: str = Field(..., min_length=2, max_length=16)
    text: str = Field(..., min_length=1, max_length=5000)
    voice: Optional[str] = Field(default=None, max_length=255)
    payload: dict[str, Any] = Field(default_factory=dict)
    target_worker_key: Optional[str] = Field(default=None, max_length=128)
    max_attempts: Optional[int] = Field(default=None, ge=1, le=10)


class WorkerActivationRequest(BaseModel):
    pairing_code: str = Field(..., min_length=3, max_length=256)
    label: Optional[str] = Field(default=None, max_length=120)
    supports_f5: Optional[bool] = None
    supports_qwen: Optional[bool] = None
    capabilities: dict[str, Any] = Field(default_factory=dict)
    runtime_metadata: dict[str, Any] = Field(default_factory=dict)


class WorkerPollRequest(BaseModel):
    max_jobs: int = Field(default=1, ge=1, le=10)
    wait_for_jobs: bool = True
    supports_f5: Optional[bool] = None
    supports_qwen: Optional[bool] = None
    capabilities: dict[str, Any] = Field(default_factory=dict)
    runtime_metadata: dict[str, Any] = Field(default_factory=dict)


class WorkerCompleteRequest(BaseModel):
    audio_base64: str = Field(..., min_length=8)
    content_type: Optional[str] = Field(default=None, max_length=120)
    source_url: Optional[str] = Field(default=None, max_length=1000)
    result_payload: dict[str, Any] = Field(default_factory=dict)


class WorkerFailRequest(BaseModel):
    error_code: Optional[str] = Field(default=None, max_length=120)
    error_message: str = Field(..., min_length=1, max_length=2000)
    retryable: bool = True


def get_worker_control_service(db: Session = Depends(get_db)) -> WorkerControlPlaneService:
    return WorkerControlPlaneService(db)


def _raise_worker_http_error(error: Exception) -> None:
    if isinstance(error, WorkerAuthError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    if isinstance(error, WorkerPermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    if isinstance(error, WorkerNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    if isinstance(error, WorkerConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if isinstance(error, WorkerValidationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    if isinstance(error, WorkerControlPlaneError):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error
    raise error


def _require_worker_agent(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        return service.authenticate_worker(authorization)
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.get("/workers")
async def list_user_workers(
    user: dict = Depends(get_current_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        return {"success": True, "workers": service.list_workers_for_user(int(user["id"]))}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.post("/workers/pairing-tokens")
async def create_pairing_token(
    request: PairingTokenRequest,
    user: dict = Depends(get_current_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        payload = service.issue_pairing_token(
            owner_user_id=int(user["id"]),
            label_hint=request.label_hint,
            provider_hint=request.provider_hint,
            is_managed=False,
        )
        return {"success": True, **payload}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.post("/workers/jobs")
async def create_user_worker_job(
    request: ManualWorkerJobRequest,
    user: dict = Depends(get_current_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        job = service.enqueue_job(
            provider=request.provider,
            text=request.text,
            voice=request.voice,
            payload=request.payload,
            owner_user_id=int(user["id"]),
            created_by_user_id=int(user["id"]),
            target_worker_key=request.target_worker_key,
            max_attempts=request.max_attempts,
        )
        return {"success": True, "job": job}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.get("/workers/jobs/{job_id}")
async def get_user_worker_job(
    job_id: str,
    user: dict = Depends(get_current_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        return {"success": True, "job": service.get_job_for_user(owner_user_id=int(user["id"]), job_id=job_id)}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.post("/workers/{worker_key}/disable")
async def disable_user_worker(
    worker_key: str,
    user: dict = Depends(get_current_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        worker = service.disable_worker_for_user(owner_user_id=int(user["id"]), worker_key=worker_key)
        return {"success": True, "worker": worker}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.delete("/workers/{worker_key}")
async def delete_user_worker(
    worker_key: str,
    user: dict = Depends(get_current_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        service.delete_worker_for_user(owner_user_id=int(user["id"]), worker_key=worker_key)
        return {"success": True}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.get("/admin/workers")
async def list_admin_workers(
    _: dict = Depends(get_admin_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        return {"success": True, "workers": service.list_workers_admin()}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.post("/admin/workers/pairing-tokens")
async def create_admin_pairing_token(
    request: AdminPairingTokenRequest,
    _: dict = Depends(get_admin_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        payload = service.issue_pairing_token(
            owner_user_id=request.owner_user_id,
            label_hint=request.label_hint,
            provider_hint=request.provider_hint,
            is_managed=bool(request.is_managed),
        )
        return {"success": True, **payload}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.post("/admin/workers/jobs")
async def create_admin_worker_job(
    request: ManualWorkerJobRequest,
    admin: dict = Depends(get_admin_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        job = service.enqueue_job(
            provider=request.provider,
            text=request.text,
            voice=request.voice,
            payload=request.payload,
            owner_user_id=None,
            created_by_user_id=int(admin["id"]),
            target_worker_key=request.target_worker_key,
            require_managed_target=bool(request.target_worker_key),
            max_attempts=request.max_attempts,
        )
        return {"success": True, "job": job}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.get("/admin/workers/jobs/{job_id}")
async def get_admin_worker_job(
    job_id: str,
    _: dict = Depends(get_admin_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        return {"success": True, "job": service.get_job_admin(job_id=job_id)}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.post("/admin/workers/{worker_key}/disable")
async def disable_admin_worker(
    worker_key: str,
    _: dict = Depends(get_admin_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        worker = service.disable_worker_admin(worker_key=worker_key)
        return {"success": True, "worker": worker}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_router.delete("/admin/workers/{worker_key}")
async def delete_admin_worker(
    worker_key: str,
    _: dict = Depends(get_admin_user),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        service.delete_worker_admin(worker_key=worker_key)
        return {"success": True}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_agent_router.post("/activate")
async def activate_worker_agent(
    request: WorkerActivationRequest,
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        payload = service.activate_worker(
            pairing_code=request.pairing_code,
            label=request.label,
            supports_f5=request.supports_f5,
            supports_qwen=request.supports_qwen,
            capabilities=request.capabilities,
            runtime_metadata=request.runtime_metadata,
        )
        return {"success": True, **payload}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_agent_router.post("/poll")
async def poll_worker_jobs(
    request: WorkerPollRequest,
    worker=Depends(_require_worker_agent),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        deadline = time.monotonic() + max(1, settings.worker_poll_timeout_seconds)
        while True:
            payload = service.poll_worker_jobs(
                worker=worker,
                max_jobs=request.max_jobs,
                supports_f5=request.supports_f5,
                supports_qwen=request.supports_qwen,
                capabilities=request.capabilities,
                runtime_metadata=request.runtime_metadata,
            )
            if payload["jobs"] or not request.wait_for_jobs or time.monotonic() >= deadline:
                return {"success": True, **payload}
            await asyncio.sleep(1.0)
    except Exception as error:
        _raise_worker_http_error(error)


@worker_agent_router.post("/jobs/{job_id}/complete")
async def complete_worker_job(
    job_id: str,
    request: WorkerCompleteRequest,
    worker=Depends(_require_worker_agent),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        job = await service.complete_job(
            worker=worker,
            job_id=job_id,
            audio_base64=request.audio_base64,
            content_type=request.content_type,
            source_url=request.source_url,
            result_payload=request.result_payload,
        )
        return {"success": True, "job": job}
    except Exception as error:
        _raise_worker_http_error(error)


@worker_agent_router.post("/jobs/{job_id}/fail")
async def fail_worker_job(
    job_id: str,
    request: WorkerFailRequest,
    worker=Depends(_require_worker_agent),
    service: WorkerControlPlaneService = Depends(get_worker_control_service),
):
    try:
        job = service.fail_job(
            worker=worker,
            job_id=job_id,
            error_code=request.error_code,
            error_message=request.error_message,
            retryable=request.retryable,
        )
        return {"success": True, "job": job}
    except Exception as error:
        _raise_worker_http_error(error)
