"""Production-grade async background worker queue for non-blocking task processing."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)


class AsyncTaskQueue:
    def __init__(self, maxsize: int = 10000, concurrency: int = 4) -> None:
        self._queue: asyncio.Queue[
            tuple[Callable[..., Awaitable[Any]] | None, tuple[Any, ...], dict[str, Any]]
        ] = asyncio.Queue(maxsize=maxsize)
        self._concurrency = concurrency
        self._workers: list[asyncio.Task[None]] = []
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._workers = [
            asyncio.create_task(self._worker_loop(i))
            for i in range(self._concurrency)
        ]
        logger.info(
            f"[background-queue] Started {self._concurrency} background queue workers"
        )

    async def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        for _ in self._workers:
            await self._queue.put((None, (), {}))
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        logger.info("[background-queue] Stopped all background queue workers")

    def enqueue(
        self,
        func: Callable[..., Awaitable[Any]],
        *args: Any,
        **kwargs: Any,
    ) -> bool:
        if not self._running:
            logger.warning(
                "[background-queue] Queue is not running, dropping background task"
            )
            return False
        try:
            self._queue.put_nowait((func, args, kwargs))
            return True
        except asyncio.QueueFull:
            logger.error("[background-queue] Queue full! Dropping task")
            return False

    async def _worker_loop(self, worker_id: int) -> None:
        while self._running:
            item = await self._queue.get()
            func, args, kwargs = item
            if func is None:
                self._queue.task_done()
                break

            try:
                await func(*args, **kwargs)
            except Exception as exc:
                logger.error(
                    f"[background-queue] Worker #{worker_id} error executing {func.__name__}: {exc}",
                    exc_info=True,
                )
            finally:
                self._queue.task_done()


# Global production task queue instance
background_queue = AsyncTaskQueue(concurrency=4)
