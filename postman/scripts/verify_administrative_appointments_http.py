"""Exercise the local, contract-derived appointment stand-in over real HTTP.

No credentials or response bodies are written to the report. The fixed local
origin cannot be replaced with a deployed service. Reset only fictitious data.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from jsonschema import Draft202012Validator, FormatChecker


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--spec', type=Path, required=True)
    parser.add_argument('--report', type=Path, default=Path(__file__).parents[1] / '.runtime/administrative-appointments-http.json')
    args = parser.parse_args()
    spec = json.loads(args.spec.read_text(encoding='utf-8-sig'))
    base_url = 'http://127.0.0.1:4900/api/v1'
    checks = []

    def request(method, path, expected, *, token=None, body=None, contract=None, code=None):
        headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = Request(base_url + path, method=method, headers=headers,
                      data=None if body is None else json.dumps(body).encode())
        try:
            response = urlopen(req, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            assert response.status == expected, f'{method} {path}: {response.status}, esperado {expected}'
            assert response.headers.get('Cache-Control') == 'no-store'
            assert response.headers.get_content_type() == ('application/problem+json' if expected >= 400 else 'application/json')
            raw = response.read()
            result = json.loads(raw) if raw else None
        if code:
            assert result['errorCode'] == code
        if contract:
            content = spec['paths'][contract][method.lower()]['responses'][str(expected)].get('content')
            if content:
                media_type = 'application/problem+json' if expected >= 400 else 'application/json'
                schema = {**content[media_type]['schema'], 'components': spec['components']}
                Draft202012Validator(schema, format_checker=FormatChecker()).validate(result)
        checks.append({'method': method, 'path': path, 'status': expected, 'schemaValidated': contract is not None})
        return result

    def fixture(**body):
        return request('POST', '/../__simulation/fixture', 204, body={'action': 'appointment-state', **body})

    request('POST', '/../__simulation/reset', 204)
    tokens = {}
    for role, email in [('ADMINISTRATOR', 'administrator'), ('OWNER', 'owner'),
                        ('OTHER_OWNER', 'other-owner'), ('VETERINARIAN', 'veterinarian'),
                        ('SUPER_ADMIN', 'superadmin'), ('OTHER_ADMINISTRATOR', 'flaky-administrator'),
                        ('READ_ONLY_ADMINISTRATOR', 'read-only-administrator')]:
        tokens[role] = request('POST', '/auth/sessions', 200, body={
            'email': email + '@roles.test', 'password': 'SimulationOnly!2026',
        }, contract='/api/v1/auth/sessions')['accessToken']
    today = datetime.now(timezone(timedelta(hours=-5))).date()
    tomorrow = (today + timedelta(days=1)).isoformat()
    query = '?' + urlencode({'from': tomorrow, 'to': tomorrow})
    list_contract = '/api/v1/appointments'
    detail_contract = '/api/v1/appointments/{appointmentId}'
    events_contract = detail_contract + '/events'
    status_contract = detail_contract + '/status'
    admin = tokens['ADMINISTRATOR']
    first = request('GET', '/appointments' + query + '&page=0&size=20', 200, token=admin, contract=list_contract)
    second = request('GET', '/appointments' + query + '&page=1&size=20', 200, token=admin, contract=list_contract)
    assert first['totalElements'] == second['totalElements'] == 25
    assert len(first['items']) == 20 and len(second['items']) == 5
    assert not {item['id'] for item in first['items']} & {item['id'] for item in second['items']}
    assert any(item['assignmentStatus'] == 'NEEDS_REASSIGNMENT' for item in second['items'])
    requested = request('GET', '/appointments' + query + '&status=REQUESTED&size=100', 200, token=admin, contract=list_contract)['items']
    assert len(requested) == 20
    assert all(item['status'] == 'REQUESTED' for item in requested)
    request('GET', '/appointments' + query, 401, contract=list_contract)
    request('GET', '/appointments' + query, 403, token=tokens['SUPER_ADMIN'], contract=list_contract)
    request('GET', '/appointments' + query, 200, token=tokens['READ_ONLY_ADMINISTRATOR'], contract=list_contract)
    for role in ['OWNER', 'VETERINARIAN']:
        page = request('GET', '/appointments' + query, 200, token=tokens[role], contract=list_contract)
        assert page['items']
        identity_field = 'ownerId' if role == 'OWNER' else 'veterinarianId'
        assert len({item[identity_field] for item in page['items']}) == 1
    request('GET', '/appointments?' + urlencode({'from': today.isoformat(), 'to': (today + timedelta(days=30)).isoformat()}), 200, token=admin, contract=list_contract)
    request('GET', '/appointments?' + urlencode({'from': today.isoformat(), 'to': (today + timedelta(days=31)).isoformat()}), 400, token=admin, contract=list_contract)
    request('GET', '/appointments' + query + '&size=101', 400, token=admin, contract=list_contract)

    appointment = requested[0]
    path = '/appointments/' + appointment['id']
    detail = request('GET', path, 200, token=admin, contract=detail_contract)
    assert 'ownerEmail' not in detail and 'email' not in detail
    assert detail == appointment
    inaccessible_role = 'OTHER_OWNER' if detail['ownerId'].endswith('0004') else 'OWNER'
    request('GET', path, 404, token=tokens[inaccessible_role], contract=detail_contract)
    request('GET', path + '/events', 403, token=tokens['SUPER_ADMIN'], contract=events_contract)
    for role in ['OWNER', 'VETERINARIAN', 'SUPER_ADMIN', 'READ_ONLY_ADMINISTRATOR']:
        request('PATCH', path + '/status', 403, token=tokens[role], body={
            'status': 'CONFIRMED', 'expectedVersion': appointment['version'],
        }, contract=status_contract)
    body = {'status': 'CONFIRMED', 'expectedVersion': appointment['version']}
    for invalid in [{**body, 'status': 'INVALID'}, {**body, 'expectedVersion': '0'}, {**body, 'reason': 123}]:
        request('PATCH', path + '/status', 400, token=admin, body=invalid, contract=status_contract, code='TYPE_MISMATCH')
    request('PATCH', path + '/status', 400, token=admin, body={**body, 'extra': True}, contract=status_contract, code='UNKNOWN_PROPERTY')
    confirmed = request('PATCH', path + '/status', 200, token=admin, body=body, contract=status_contract)
    assert confirmed['id'] == appointment['id'] and confirmed['status'] == 'CONFIRMED'
    assert confirmed['version'] == appointment['version'] + 1
    replay = request('PATCH', path + '/status', 200, token=admin, body={**body, 'reason': '  '}, contract=status_contract)
    assert replay == confirmed
    request('PATCH', path + '/status', 409, token=tokens['OTHER_ADMINISTRATOR'], body=body, contract=status_contract, code='CONCURRENT_UPDATE')
    request('PATCH', path + '/status', 409, token=admin, body={**body, 'reason': 'Otro motivo'}, contract=status_contract, code='CONCURRENT_UPDATE')
    request('PATCH', path + '/status', 409, token=admin, body={
        'status': 'REJECTED', 'expectedVersion': confirmed['version'], 'reason': 'No procede',
    }, contract=status_contract, code='APPOINTMENT_TRANSITION_NOT_ALLOWED')
    events0 = request('GET', path + '/events?page=0&size=1', 200, token=admin, contract=events_contract)
    events1 = request('GET', path + '/events?page=1&size=1', 200, token=admin, contract=events_contract)
    assert events0['totalElements'] == events1['totalElements'] == 2
    assert events0['items'][0]['id'] != events1['items'][0]['id']
    event_items = events0['items'] + events1['items']
    assert [(event['occurredAt'], event['id']) for event in event_items] == sorted((event['occurredAt'], event['id']) for event in event_items)
    requested_event = next(event for event in event_items if event['eventType'] == 'REQUESTED')
    assert requested_event['actorType'] == 'HUMAN' and requested_event['actorId'] == appointment['ownerId']
    assert requested_event['reason'] == appointment['reason']
    assert any(event['eventType'] == 'CONFIRMED' for event in event_items)

    rejected_source = requested[1]
    rejected_path = '/appointments/' + rejected_source['id']
    fixture(appointmentId=rejected_source['id'], cutoffPassed=True)
    request('PATCH', rejected_path + '/status', 409, token=admin, body={
        'status': 'CONFIRMED', 'expectedVersion': rejected_source['version'],
    }, contract=status_contract, code='APPOINTMENT_CONFIRMATION_CUTOFF_PASSED')
    request('PATCH', rejected_path + '/status', 400, token=admin, body={
        'status': 'REJECTED', 'expectedVersion': rejected_source['version'], 'reason': '  ',
    }, contract=status_contract, code='INVALID_APPOINTMENT_REQUEST')
    request('PATCH', rejected_path + '/status', 400, token=admin, body={
        'status': 'REJECTED', 'expectedVersion': rejected_source['version'], 'reason': 'x' * 1001,
    }, contract=status_contract, code='VALIDATION_FAILED')
    rejected = request('PATCH', rejected_path + '/status', 200, token=admin, body={
        'status': 'REJECTED', 'expectedVersion': rejected_source['version'], 'reason': ' Agenda no disponible ',
    }, contract=status_contract)
    assert rejected['status'] == 'REJECTED' and rejected['version'] == rejected_source['version'] + 1
    history = request('GET', rejected_path + '/events', 200, token=admin, contract=events_contract)
    assert any(event['reason'] == 'Agenda no disponible' and event['eventType'] == 'REJECTED' for event in history['items'])

    inactive = requested[2]
    fixture(appointmentId=inactive['id'], participantInactive=True)
    request('PATCH', '/appointments/' + inactive['id'] + '/status', 409, token=admin, body={
        'status': 'CONFIRMED', 'expectedVersion': inactive['version'],
    }, contract=status_contract, code='APPOINTMENT_PARTICIPANT_INACTIVE')
    concurrent = requested[3]
    fixture(appointmentId=concurrent['id'], advanceVersion=True)
    request('PATCH', '/appointments/' + concurrent['id'] + '/status', 409, token=admin, body={
        'status': 'CONFIRMED', 'expectedVersion': concurrent['version'],
    }, contract=status_contract, code='CONCURRENT_UPDATE')
    unicode_source = requested[4]
    unicode_path = '/appointments/' + unicode_source['id']
    request('PATCH', unicode_path + '/status', 400, token=admin, body={
        'status': 'REJECTED', 'expectedVersion': unicode_source['version'], 'reason': '\u001c',
    }, contract=status_contract, code='INVALID_APPOINTMENT_REQUEST')
    request('PATCH', unicode_path + '/status', 200, token=admin, body={
        'status': 'REJECTED', 'expectedVersion': unicode_source['version'], 'reason': '\u00a0',
    }, contract=status_contract)
    unicode_history = request('GET', unicode_path + '/events', 200, token=admin, contract=events_contract)
    assert any(event['eventType'] == 'REJECTED' and event['reason'] == '\u00a0' for event in unicode_history['items'])
    report = {'simulationOnly': True, 'checkedAtUtc': datetime.now(timezone.utc).isoformat(),
              'openApiVersion': spec['info']['version'], 'requestCount': len(checks),
              'schemaValidatedCount': sum(check['schemaValidated'] for check in checks), 'checks': checks}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(checks)} peticiones verificadas, {report["schemaValidatedCount"]} contra esquemas; solo simulación local.')
    request('POST', '/../__simulation/reset', 204)


if __name__ == '__main__':
    main()
