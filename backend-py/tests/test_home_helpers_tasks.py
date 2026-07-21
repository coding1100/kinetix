"""Unit tests for task-related home_helpers utilities."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.models.enums import TaskStatus
from app.services.home_helpers import (
    comment_relative_time,
    end_of_today,
    format_due_date,
    is_overdue,
    start_of_today,
)


def test_start_and_end_of_today_utc():
    start = start_of_today()
    end = end_of_today()
    assert start.tzinfo == timezone.utc
    assert end.tzinfo == timezone.utc
    assert start.hour == 0 and start.minute == 0
    assert end.hour == 23 and end.minute == 59
    assert start.date() == end.date()


def test_format_due_date_today_tomorrow_and_month():
    today_noon = start_of_today().replace(hour=12)
    assert format_due_date(today_noon) == "Today"

    tomorrow_noon = (start_of_today() + timedelta(days=1)).replace(hour=12)
    assert format_due_date(tomorrow_noon) == "Tomorrow"

    future = datetime(2030, 3, 15, 9, 0, tzinfo=timezone.utc)
    assert format_due_date(future) == "Mar 15"


def test_format_due_date_none():
    assert format_due_date(None) is None


def test_is_overdue():
    yesterday = start_of_today() - timedelta(hours=1)
    assert is_overdue(yesterday, TaskStatus.TODO) is True
    assert is_overdue(yesterday, TaskStatus.DONE) is False
    assert is_overdue(None, TaskStatus.TODO) is False
    tomorrow = end_of_today() + timedelta(hours=1)
    assert is_overdue(tomorrow, TaskStatus.TODO) is False


def test_comment_relative_time_buckets():
    now = datetime.now(timezone.utc)
    assert comment_relative_time(now) == "Just now"
    assert comment_relative_time(now - timedelta(hours=2)) == "2h ago"
    assert comment_relative_time(now - timedelta(days=1)) == "Yesterday"
    assert comment_relative_time(now - timedelta(days=3)) == "3d ago"
