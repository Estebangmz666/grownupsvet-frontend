"""Extract only timestamp, method, path and status from local simulation logs.

The initial browser run starts after verify_roles_http.py has completed.
No headers, bodies, credentials or tokens are copied to the audit output.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path


def instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def main() -> None:
    runtime = Path(__file__).parents[1] / '.runtime'
    parser = argparse.ArgumentParser()
    parser.add_argument('--log', type=Path, default=runtime / 'roles.ndjson')
    parser.add_argument('--after', help='UTC timestamp; defaults to the HTTP verification completion timestamp')
    parser.add_argument('--output', type=Path, default=runtime / 'browser-http-audit-normal.json')
    parser.add_argument('--start-at-invalid-login', action='store_true',
                        help='Optional compatibility mode for the original role test, which began with an invalid login')
    args = parser.parse_args()
    after = args.after
    if after is None:
        after = json.loads((runtime / 'http-verification.json').read_text(encoding='utf-8-sig'))['checkedAtUtc']
    cutoff = instant(after)
    safe_events = []
    lines = args.log.read_text(encoding='utf-8-sig').splitlines()
    for index, line in enumerate(lines):
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            if index == len(lines) - 1:
                break  # A running server may still be writing its final line.
            raise
        if event.get('event') == 'request' and instant(event['ts']) > cutoff:
            safe_events.append({
                'timestampUtc': event['ts'],
                'method': event['method'],
                'path': event['path'],
                'status': event['statusCode'],
            })
    # A later invalid login must not silently discard earlier management work.
    if args.start_at_invalid_login:
        start = next((index for index, event in enumerate(safe_events)
                      if event['method'] == 'POST' and event['path'] == '/v1/auth/sessions'
                      and event['status'] == 401), 0)
        safe_events = safe_events[start:]
    report = {
        'simulationOnly': True,
        'afterUtc': after,
        'fieldsRetained': ['timestampUtc', 'method', 'path', 'status'],
        'requestCount': len(safe_events),
        'events': safe_events,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(safe_events)} eventos HTTP sin cabeceras, cuerpos o tokens: {args.output}')


if __name__ == '__main__':
    main()
