"""Test unfollow on production EC2."""

from test_unfollow_jordan import main

if __name__ == "__main__":
    import os

    os.environ.setdefault("API_TEST_BASE", "http://3.140.5.67")
    raise SystemExit(main())
