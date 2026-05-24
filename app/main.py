"""Small admin CLI for database initialization and live rescoring."""

from __future__ import annotations

import argparse

from .database import create_database, get_session_factory
from .service import rescore_all_entries


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description="World Cup Bracket Challenge admin CLI")
    parser.add_argument(
        "command",
        choices=["init-db", "rescore-all"],
        help="Administrative command to run.",
    )
    return parser.parse_args()


def main() -> None:
    """Execute the requested admin command."""
    args = parse_args()
    if args.command == "init-db":
        create_database()
        print("Database initialized.")
        return

    if args.command == "rescore-all":
        create_database()
        session = get_session_factory()()
        try:
            updated = rescore_all_entries(session)
        finally:
            session.close()
        print(f"Rescored {updated} entries.")
        return


if __name__ == "__main__":
    main()
