"""Verify real HTTP against the local simulation and the canonical OpenAPI.

Requires Python 3.9+ and jsonschema. No requests can target a remote service.
The report contains statuses and counts, never login bodies or tokens.
"""
from __future__ import annotations

import argparse
import base64
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from jsonschema import Draft202012Validator, FormatChecker


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4900/api/v1')
    parser.add_argument('--spec', type=Path, required=True)
    parser.add_argument('--report', type=Path, default=Path(__file__).parents[1] / '.runtime/http-verification.json')
    args = parser.parse_args()
    parsed = urlparse(args.base_url)
    if (parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost'}
            or parsed.port != 4900 or parsed.path.rstrip('/') != '/api/v1'
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        parser.error('La verificación solo admite http://127.0.0.1:4900/api/v1 o localhost:4900; nunca el gateway de producción.')
    spec = json.loads(args.spec.read_text(encoding='utf-8-sig'))
    checks: list[dict] = []

    def request(method, path, expected_status, *, token=None, body=None, contract_path=None, error_code=None):
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        data = None if body is None else json.dumps(body).encode()
        req = Request(args.base_url.rstrip('/') + path, data=data, headers=headers, method=method)
        try:
            response = urlopen(req, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            status = response.status
            raw = response.read()
            assert status == expected_status, f'{method} {path}: {status}, esperado {expected_status}'
            assert response.headers.get('Cache-Control') == 'no-store', f'{path}: falta no-store'
            result = json.loads(raw) if raw else None
            if status == 201 and path != '/auth/registrations':
                assert response.headers.get('Location') == '/api/v1/' + path.lstrip('/') + '/' + result['id']
            if status == 201 and path == '/auth/registrations':
                assert response.headers.get('Location') is None
        if error_code:
            assert result['errorCode'] == error_code
        if contract_path:
            operation = spec['paths'][contract_path][method.lower()]
            documented = operation['responses'][str(status)]
            if result is not None:
                contents = documented['content']
                content_type = 'application/problem+json' if status >= 400 else 'application/json'
                schema = dict(contents[content_type]['schema'])
                schema['components'] = spec['components']
                Draft202012Validator(schema, format_checker=FormatChecker()).validate(result)
        checks.append({'method': method, 'path': path, 'status': status, 'schemaValidated': contract_path is not None})
        return result

    def dropped_mutation(path, body, label):
        lost_request = Request(args.base_url.rstrip('/') + path,
                               data=json.dumps(body).encode(),
                               headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urlopen(lost_request, timeout=10) as response:
                raise AssertionError(f'La respuesta perdida no debe producir {response.status}')
        except HTTPError as error:
            assert error.code == 502, f'Proxy error esperado para respuesta perdida, recibido {error.code}'
            error.close()
            checks.append({'method': 'POST', 'path': path, 'status': 502,
                           'schemaValidated': False, 'injectedFailure': label})

    # Reset is explicitly simulation-only, not an invented backend endpoint.
    request('POST', '/../__simulation/reset', 204)
    request('POST', '/auth/sessions', 401, body={'email': 'owner@roles.test', 'password': 'wrong'}, contract_path='/api/v1/auth/sessions')
    sessions = {}
    for role, email in [('OWNER', 'owner@roles.test'), ('SUPER_ADMIN', 'superadmin@roles.test'),
                        ('ADMINISTRATOR', 'administrator@roles.test'), ('VETERINARIAN', 'veterinarian@roles.test')]:
        session = request('POST', '/auth/sessions', 200,
                          body={'email': email, 'password': 'SimulationOnly!2026'}, contract_path='/api/v1/auth/sessions')
        assert session['user']['role'] == role
        payload = session['accessToken'].split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        for claim, field in [('sub', 'id'), ('email', 'email'), ('role', 'role'), ('permissions', 'permissions')]:
            assert claims[claim] == session['user'][field]
        assert claims['exp'] > datetime.now(timezone.utc).timestamp()
        sessions[role] = session

    def token(role):
        return sessions[role]['accessToken']

    own_profile = request('GET', '/users/me', 200, token=token('OWNER'), contract_path='/api/v1/users/me')
    assert own_profile['id'] == sessions['OWNER']['user']['id']
    own_pets = request('GET', '/pets', 200, token=token('OWNER'), contract_path='/api/v1/pets')
    assert own_pets['totalElements'] == 2
    request('GET', '/pets/' + own_pets['items'][0]['id'], 200, token=token('OWNER'), contract_path='/api/v1/pets/{petId}')
    request('GET', '/pets/c1000000-0000-4000-8000-000000000003', 404, token=token('OWNER'), contract_path='/api/v1/pets/{petId}')

    first = request('GET', '/administrators?page=0&size=20', 200, token=token('SUPER_ADMIN'), contract_path='/api/v1/administrators')
    second = request('GET', '/administrators?page=1&size=20', 200, token=token('SUPER_ADMIN'), contract_path='/api/v1/administrators')
    assert first['totalElements'] == second['totalElements'] == 23
    assert len(first['items']) == 20 and len(second['items']) == 3
    assert not ({item['id'] for item in first['items']} & {item['id'] for item in second['items']})
    filtered = request('GET', '/administrators?status=DISABLED', 200, token=token('SUPER_ADMIN'), contract_path='/api/v1/administrators')
    assert filtered['items'] and all(item['status'] == 'DISABLED' for item in filtered['items'])
    empty = request('GET', '/administrators?page=99&size=20', 200, token=token('SUPER_ADMIN'), contract_path='/api/v1/administrators')
    assert empty['items'] == [] and empty['totalElements'] == 23
    request('GET', '/administrators?size=101', 400, token=token('SUPER_ADMIN'), contract_path='/api/v1/administrators')
    vets = request('GET', '/veterinarians', 200, token=token('ADMINISTRATOR'), contract_path='/api/v1/veterinarians')
    assert vets['totalElements'] == 25
    active_vets = request('GET', '/veterinarians?status=ACTIVE', 200, token=token('ADMINISTRATOR'), contract_path='/api/v1/veterinarians')
    assert all(item['status'] == 'ACTIVE' for item in active_vets['items'])

    today = datetime.now(timezone(timedelta(hours=-5))).date().isoformat()
    date_query = '?' + urlencode({'from': today, 'to': today})
    vet_agenda = request('GET', '/appointments' + date_query, 200, token=token('VETERINARIAN'), contract_path='/api/v1/appointments')
    assert vet_agenda['items'] and all(item['veterinarianId'] == sessions['VETERINARIAN']['user']['id'] for item in vet_agenda['items'])
    owner_agenda = request('GET', '/appointments' + date_query, 200, token=token('OWNER'), contract_path='/api/v1/appointments')
    assert all(item['ownerId'] == sessions['OWNER']['user']['id'] for item in owner_agenda['items'])
    request('GET', '/appointments?from=2026-10-22&to=2026-10-21', 400, token=token('VETERINARIAN'), contract_path='/api/v1/appointments')
    request('GET', '/users/me', 403, token=token('SUPER_ADMIN'), contract_path='/api/v1/users/me')
    request('GET', '/veterinarians', 403, token=token('SUPER_ADMIN'), contract_path='/api/v1/veterinarians')
    request('GET', '/administrators', 403, token=token('ADMINISTRATOR'), contract_path='/api/v1/administrators')
    request('GET', '/pets', 403, token=token('VETERINARIAN'), contract_path='/api/v1/pets')

    # Administrative increment: actual HTTP writes against this stand-in only.
    def fixture(action, **fields):
        return request('POST', '/../__simulation/fixture', 204, body={'action': action, **fields})

    # Public owner signup: DTO-derived receipts and field errors, no session.
    signup_path = '/auth/registrations'
    signup_contract = '/api/v1/auth/registrations'
    signup_body = {'email': 'signup@roles.test', 'fullName': 'María Persona Ficticia',
                   'dateOfBirth': '1960-05-15', 'phoneNumber': '+573001234567',
                   'password': '  Frase de prueba 😀 2026  '}
    invalid_signup = request('POST', signup_path, 400,
                             body={'email': 'invalid', 'fullName': 'Uno', 'dateOfBirth': '2099-12-31',
                                   'phoneNumber': '3001234567', 'password': 'short'},
                             contract_path=signup_contract, error_code='VALIDATION_FAILED')
    assert {item['field'] for item in invalid_signup['fieldErrors']} == set(signup_body)
    request('POST', signup_path, 400, body={**signup_body, 'role': 'SUPER_ADMIN'},
            contract_path=signup_contract, error_code='INVALID_REQUEST')
    common_password = request('POST', signup_path, 400,
                              body={**signup_body, 'password': 'films+pic+galeries'},
                              contract_path=signup_contract, error_code='VALIDATION_FAILED')
    assert {item['field'] for item in common_password['fieldErrors']} == {'password'}
    fixture('next-authentication', operation='registration', fieldError='phoneNumber')
    server_invalid = request('POST', signup_path, 400, body=signup_body,
                             contract_path=signup_contract, error_code='VALIDATION_FAILED')
    assert server_invalid['fieldErrors'][0]['field'] == 'phoneNumber'
    signup = request('POST', signup_path, 201, body={**signup_body, 'email': 'Signup@roles.test'},
                     contract_path=signup_contract)
    assert set(signup) == {'id', 'email'} and signup['email'] == 'signup@roles.test'
    request('POST', signup_path, 409, body=signup_body,
            contract_path=signup_contract, error_code='EMAIL_ALREADY_REGISTERED')
    new_owner = request('POST', '/auth/sessions', 200,
                        body={'email': signup['email'], 'password': signup_body['password']},
                        contract_path='/api/v1/auth/sessions')
    assert new_owner['user']['role'] == 'OWNER'
    new_profile = request('GET', '/users/me', 200, token=new_owner['accessToken'],
                          contract_path='/api/v1/users/me')
    assert new_profile['fullName'] == signup_body['fullName']
    request('POST', '/auth/sessions', 401,
            body={'email': signup['email'], 'password': signup_body['password'].strip()},
            contract_path='/api/v1/auth/sessions', error_code='INVALID_CREDENTIALS')
    fixture('next-authentication', operation='login', errorStatus=503)
    injected_login = request('POST', '/auth/sessions', 503,
                              body={'email': signup['email'], 'password': signup_body['password']},
                              error_code='SIMULATION_TEMPORARY_UNAVAILABLE')
    fixture('next-authentication', operation='registration', errorStatus=503)
    injected_signup = request('POST', signup_path, 503,
                               body={**signup_body, 'email': 'retry-after-503@roles.test'},
                               error_code='SIMULATION_TEMPORARY_UNAVAILABLE')
    for failure in [injected_login, injected_signup]:
        error_schema = {'$ref': '#/components/schemas/ApiErrorResponseDTO', 'components': spec['components']}
        Draft202012Validator(error_schema, format_checker=FormatChecker()).validate(failure)
    # 503 is an explicitly injected outage; it is not a registration operation response in OpenAPI.
    request('POST', signup_path, 201, body={**signup_body, 'email': 'retry-after-503@roles.test'},
            contract_path=signup_contract)
    fixture('next-mutation', drop=True)
    dropped_body = {**signup_body, 'email': 'lost-signup-response@roles.test'}
    dropped_mutation(signup_path, dropped_body, 'response-dropped-after-account-created')
    request('POST', '/auth/sessions', 200,
            body={'email': dropped_body['email'], 'password': dropped_body['password']},
            contract_path='/api/v1/auth/sessions')
    request('POST', signup_path, 409, body=dropped_body,
            contract_path=signup_contract, error_code='EMAIL_ALREADY_REGISTERED')

    # Public recovery uses the real DTOs and response schemas, with fictitious accounts only.
    recovery_path = '/auth/password-recoveries'
    verification_path = recovery_path + '/verifications'
    reset_path = '/auth/password-resets'
    recovery_email = signup['email']

    def request_recovery(email, expected=202, error=None):
        return request('POST', recovery_path, expected, body={'email': email},
                       contract_path='/api/v1' + recovery_path, error_code=error)

    def recovery_code(email):
        receipt = request('GET', '/../__simulation/recovery?' + urlencode({'email': email}), 200)
        assert receipt['simulationOnly'] is True and receipt['code'] == '012345'
        return receipt['code']

    def verify_recovery(email, code, expected=200, error=None):
        return request('POST', verification_path, expected, body={'email': email, 'code': code},
                       contract_path='/api/v1' + verification_path, error_code=error)

    def reset_password(reset_token, expected=204, *, password='  Nueva frase ficticia 🦊 2026  ', confirm=None, error=None):
        return request('POST', reset_path, expected,
                       body={'resetToken': reset_token, 'newPassword': password,
                             'confirmNewPassword': password if confirm is None else confirm},
                       contract_path='/api/v1' + reset_path, error_code=error)

    invalid_recovery = request_recovery('invalid', 400, 'VALIDATION_FAILED')
    assert {item['field'] for item in invalid_recovery['fieldErrors']} == {'email'}
    unknown_recovery = request_recovery('unknown-recovery@roles.test')
    inactive_email = next(item['email'] for item in filtered['items'] if item['status'] == 'DISABLED')
    inactive_recovery = request_recovery(inactive_email)
    fixture('next-authentication', operation='recovery-request', errorStatus=503)
    request_recovery(recovery_email, 503, 'SIMULATION_TEMPORARY_UNAVAILABLE')
    accepted_recovery = request_recovery(recovery_email)
    assert accepted_recovery == unknown_recovery == inactive_recovery
    assert set(accepted_recovery) == {'message'}
    request_recovery(recovery_email, 429, 'PASSWORD_RECOVERY_RATE_LIMITED')
    code = recovery_code(recovery_email)
    for invalid_code in ['12345', '12345a', 123456]:
        verify_recovery(recovery_email, invalid_code, 400, 'VALIDATION_FAILED')
    verify_recovery(recovery_email, '999999', 400, 'INVALID_PASSWORD_RECOVERY_CODE')
    verify_recovery('unknown-recovery@roles.test', code, 400, 'INVALID_PASSWORD_RECOVERY_CODE')
    fixture('next-authentication', operation='recovery-verification', fieldError='code')
    rejected_code = verify_recovery(recovery_email, code, 400, 'VALIDATION_FAILED')
    assert {item['field'] for item in rejected_code['fieldErrors']} == {'code'}
    permission = verify_recovery(recovery_email, code)
    assert re.fullmatch(r'[A-Za-z0-9_-]{43}', permission['resetToken'])
    assert set(permission) == {'resetToken', 'expiresIn'} and 0 < permission['expiresIn'] <= 300
    verify_recovery(recovery_email, code, 400, 'INVALID_PASSWORD_RECOVERY_CODE')
    reset_token = permission['resetToken']
    for invalid_password in ['films+pic+galeries', 'a' * 14, '🦊' * 14, 'a' * 129]:
        rejected_password = reset_password(reset_token, 400, password=invalid_password,
                                            error='VALIDATION_FAILED')
        assert {item['field'] for item in rejected_password['fieldErrors']} == {'newPassword', 'confirmNewPassword'}
    reset_password(reset_token, 400, confirm='Otra frase ficticia 2026!', error='PASSWORD_CONFIRMATION_MISMATCH')
    reset_password('not-a-reset-token', 400, error='VALIDATION_FAILED')
    reset_password('z' * 43, 400, error='INVALID_PASSWORD_RESET_TOKEN')
    fixture('next-authentication', operation='password-reset', fieldError='newPassword')
    rejected_reset = reset_password(reset_token, 400, error='VALIDATION_FAILED')
    assert {item['field'] for item in rejected_reset['fieldErrors']} == {'newPassword'}
    fixture('next-authentication', operation='password-reset', errorStatus=503)
    reset_password(reset_token, 503, error='SIMULATION_TEMPORARY_UNAVAILABLE')
    request('GET', '/users/me', 200, token=new_owner['accessToken'], contract_path='/api/v1/users/me')
    # All rejected passwords/confirmations retain the same permission; only this write consumes it.
    assert reset_password(reset_token) is None
    request('GET', '/users/me', 401, token=new_owner['accessToken'], contract_path='/api/v1/users/me')
    request('POST', '/auth/sessions', 401,
            body={'email': recovery_email, 'password': signup_body['password']},
            contract_path='/api/v1/auth/sessions', error_code='INVALID_CREDENTIALS')
    recovered_owner = request('POST', '/auth/sessions', 200,
                               body={'email': recovery_email, 'password': '  Nueva frase ficticia 🦊 2026  '},
                               contract_path='/api/v1/auth/sessions')
    assert recovered_owner['user']['id'] == new_owner['user']['id']
    request('GET', '/users/me', 200, token=recovered_owner['accessToken'], contract_path='/api/v1/users/me')
    request('POST', '/auth/sessions', 401,
            body={'email': recovery_email, 'password': 'Nueva frase ficticia 🦊 2026'},
            contract_path='/api/v1/auth/sessions', error_code='INVALID_CREDENTIALS')
    reset_password(reset_token, 400, error='INVALID_PASSWORD_RESET_TOKEN')

    # Lost verification response consumes the code but leaves the existing password usable.
    lost_verification_email = 'lost-verification-response@roles.test'
    request('POST', signup_path, 201, body={**signup_body, 'email': lost_verification_email},
            contract_path=signup_contract)
    request_recovery(lost_verification_email)
    lost_code = recovery_code(lost_verification_email)
    fixture('next-mutation', drop=True)
    dropped_mutation(verification_path, {'email': lost_verification_email, 'code': lost_code},
                     'response-dropped-after-recovery-code-consumed')
    verify_recovery(lost_verification_email, lost_code, 400, 'INVALID_PASSWORD_RECOVERY_CODE')
    request('POST', '/auth/sessions', 200,
            body={'email': lost_verification_email, 'password': signup_body['password']},
            contract_path='/api/v1/auth/sessions')

    # Lost reset response may already have changed the password and revoked the old session.
    lost_reset_email = 'lost-reset-response@roles.test'
    request('POST', signup_path, 201, body={**signup_body, 'email': lost_reset_email},
            contract_path=signup_contract)
    old_reset_session = request('POST', '/auth/sessions', 200,
                                body={'email': lost_reset_email, 'password': signup_body['password']},
                                contract_path='/api/v1/auth/sessions')
    request_recovery(lost_reset_email)
    lost_permission = verify_recovery(lost_reset_email, recovery_code(lost_reset_email))
    lost_reset_body = {'resetToken': lost_permission['resetToken'], 'newPassword': 'Otra frase 🦊 ficticia 2026!',
                      'confirmNewPassword': 'Otra frase 🦊 ficticia 2026!'}
    fixture('next-mutation', drop=True)
    dropped_mutation(reset_path, lost_reset_body, 'response-dropped-after-password-reset')
    request('GET', '/users/me', 401, token=old_reset_session['accessToken'], contract_path='/api/v1/users/me')
    request('POST', '/auth/sessions', 401,
            body={'email': lost_reset_email, 'password': signup_body['password']},
            contract_path='/api/v1/auth/sessions', error_code='INVALID_CREDENTIALS')
    request('POST', '/auth/sessions', 200,
            body={'email': lost_reset_email, 'password': lost_reset_body['newPassword']},
            contract_path='/api/v1/auth/sessions')
    reset_password(lost_permission['resetToken'], 400, error='INVALID_PASSWORD_RESET_TOKEN')

    def activation(email):
        return request('GET', '/../__simulation/activation?' + urlencode({'email': email}), 200)

    def activate(activation_token, expected=204, *, password='Una frase ficticia 2026!', confirm=None, error=None):
        return request('POST', '/auth/account-activations', expected,
                       body={'token': activation_token, 'password': password,
                             'confirmPassword': password if confirm is None else confirm},
                       contract_path='/api/v1/auth/account-activations', error_code=error)

    missing_id = 'a1000000-0000-4000-8000-999999999999'
    request('GET', '/administrators/' + missing_id, 404, token=token('SUPER_ADMIN'), contract_path='/api/v1/administrators/{id}')
    request('POST', '/administrators', 403, token=token('OWNER'), body={'email': 'denied@roles.test', 'fullName': 'Persona Ficticia'}, contract_path='/api/v1/administrators')
    invalid = request('POST', '/administrators', 400, token=token('SUPER_ADMIN'), body={'email': 'invalid', 'fullName': 'Uno'}, contract_path='/api/v1/administrators', error_code='VALIDATION_FAILED')
    assert {item['field'] for item in invalid['fieldErrors']} == {'email', 'fullName'}
    request('POST', '/administrators', 409, token=token('SUPER_ADMIN'), body={'email': 'owner@roles.test', 'fullName': 'Persona Ficticia'}, contract_path='/api/v1/administrators', error_code='EMAIL_ALREADY_REGISTERED')
    administrator = request('POST', '/administrators', 201, token=token('SUPER_ADMIN'), body={'email': 'created-administrator@roles.test', 'fullName': 'Administradora Ficticia'}, contract_path='/api/v1/administrators')
    assert administrator['status'] == 'PENDING_ACTIVATION'
    admin_path = '/administrators/' + administrator['id']
    request('GET', admin_path, 200, token=token('SUPER_ADMIN'), contract_path='/api/v1/administrators/{id}')
    changed_admin = request('PUT', admin_path, 200, token=token('SUPER_ADMIN'), body={'fullName': 'Administradora Modificada'}, contract_path='/api/v1/administrators/{id}')
    assert changed_admin['email'] == administrator['email'] and changed_admin['fullName'] == 'Administradora Modificada'
    request('PUT', admin_path, 400, token=token('SUPER_ADMIN'), body={'fullName': 'Persona Ficticia', 'email': 'cannot-change@roles.test'}, contract_path='/api/v1/administrators/{id}')
    request('PATCH', admin_path + '/status', 409, token=token('SUPER_ADMIN'), body={'status': 'ACTIVE'}, contract_path='/api/v1/administrators/{id}/status', error_code='STAFF_ACTIVATION_REQUIRED')
    request('PATCH', admin_path + '/status', 400, token=token('SUPER_ADMIN'), body={'status': 'PENDING_ACTIVATION'}, contract_path='/api/v1/administrators/{id}/status', error_code='INVALID_STAFF_STATUS')
    invitation_path = '/staff/' + administrator['id'] + '/invitations'
    first_invitation = activation(administrator['email'])
    # Reading the fixture twice does not consume or rotate a token.
    assert activation(administrator['email'])['token'] == first_invitation['token']
    request('POST', invitation_path, 429, token=token('SUPER_ADMIN'), contract_path='/api/v1/staff/{userId}/invitations', error_code='STAFF_INVITATION_RATE_LIMITED')
    fixture('age-invitations', email=administrator['email'], seconds=61)
    resent = request('POST', invitation_path, 202, token=token('SUPER_ADMIN'), contract_path='/api/v1/staff/{userId}/invitations')
    assert resent['userId'] == administrator['id'] and resent['deliveryStatus'] == 'PENDING'
    second_invitation = activation(administrator['email'])
    assert second_invitation['token'] != first_invitation['token']
    activate(first_invitation['token'], 400, error='STAFF_INVITATION_INVALID')
    activate(second_invitation['token'], 400, password='films+pic+galeries', error='VALIDATION_FAILED')
    activate(second_invitation['token'], 400, confirm='Otra frase distinta 2026!', error='PASSWORD_CONFIRMATION_MISMATCH')
    activate(second_invitation['token'])
    activate(second_invitation['token'], 400, error='STAFF_INVITATION_INVALID')
    activated_login = request('POST', '/auth/sessions', 200, body={'email': administrator['email'], 'password': 'Una frase ficticia 2026!'}, contract_path='/api/v1/auth/sessions')
    request('POST', invitation_path, 409, token=token('SUPER_ADMIN'), contract_path='/api/v1/staff/{userId}/invitations', error_code='STAFF_INVITATION_STATE_CONFLICT')
    request('PATCH', admin_path + '/status', 200, token=token('SUPER_ADMIN'), body={'status': 'DISABLED'}, contract_path='/api/v1/administrators/{id}/status')
    request('GET', '/veterinarians', 401, token=activated_login['accessToken'], contract_path='/api/v1/veterinarians')
    request('PATCH', admin_path + '/status', 200, token=token('SUPER_ADMIN'), body={'status': 'ACTIVE'}, contract_path='/api/v1/administrators/{id}/status')
    request('GET', '/veterinarians', 401, token=activated_login['accessToken'], contract_path='/api/v1/veterinarians')
    request('POST', '/auth/sessions', 200, body={'email': administrator['email'], 'password': 'Una frase ficticia 2026!'}, contract_path='/api/v1/auth/sessions')

    vet_body = {'email': 'created-veterinarian@roles.test', 'fullName': 'Veterinaria Ficticia',
                'professionalPhoneNumber': '+573001234567', 'professionalRegistrationNumber': 'inc-one',
                'baseDegreeTitle': 'Medicina veterinaria', 'baseDegreeInstitution': 'Universidad ficticia',
                'biography': 'Biografía de prueba'}
    request('POST', '/veterinarians', 409, token=token('ADMINISTRATOR'), body={**vet_body, 'professionalRegistrationNumber': 'sim-0001'}, contract_path='/api/v1/veterinarians', error_code='PROFESSIONAL_REGISTRATION_ALREADY_EXISTS')
    veterinarian = request('POST', '/veterinarians', 201, token=token('ADMINISTRATOR'), body=vet_body, contract_path='/api/v1/veterinarians')
    assert veterinarian['professionalRegistrationNumber'] == 'INC-ONE' and veterinarian['qualifications'][0]['isBaseDegree']
    vet_path = '/veterinarians/' + veterinarian['id']
    request('GET', vet_path, 200, token=token('ADMINISTRATOR'), contract_path='/api/v1/veterinarians/{id}')
    vet_update = {key: value for key, value in vet_body.items() if key != 'email'}
    vet_update.update({'fullName': 'Veterinaria Actualizada', 'biography': None})
    updated = request('PUT', vet_path, 200, token=token('ADMINISTRATOR'), body=vet_update, contract_path='/api/v1/veterinarians/{id}')
    assert updated['biography'] is None and updated['email'] == vet_body['email']
    request('PUT', vet_path, 400, token=token('ADMINISTRATOR'), body={'fullName': 'Veterinaria Incompleta'}, contract_path='/api/v1/veterinarians/{id}')
    vet_invitation_path = '/staff/' + veterinarian['id'] + '/invitations'
    vet_token = activation(veterinarian['email'])['token']
    request('DELETE', vet_invitation_path, 204, token=token('ADMINISTRATOR'), contract_path='/api/v1/staff/{userId}/invitations')
    request('DELETE', vet_invitation_path, 204, token=token('ADMINISTRATOR'), contract_path='/api/v1/staff/{userId}/invitations')
    activate(vet_token, 400, error='STAFF_INVITATION_INVALID')
    fixture('age-invitations', email=veterinarian['email'], seconds=61)
    request('POST', vet_invitation_path, 202, token=token('ADMINISTRATOR'), contract_path='/api/v1/staff/{userId}/invitations')
    expired = activation(veterinarian['email'])['token']
    fixture('expire-invitation', email=veterinarian['email'])
    activate(expired, 400, error='STAFF_INVITATION_INVALID')
    # Initial invitation + four resends reaches the rolling maximum of five.
    for _ in range(3):
        fixture('age-invitations', email=veterinarian['email'], seconds=61)
        request('POST', vet_invitation_path, 202, token=token('ADMINISTRATOR'), contract_path='/api/v1/staff/{userId}/invitations')
    fixture('age-invitations', email=veterinarian['email'], seconds=61)
    request('POST', vet_invitation_path, 429, token=token('ADMINISTRATOR'), contract_path='/api/v1/staff/{userId}/invitations', error_code='STAFF_INVITATION_RATE_LIMITED')
    request('POST', vet_invitation_path, 403, token=token('SUPER_ADMIN'), contract_path='/api/v1/staff/{userId}/invitations')
    request('GET', vet_path, 403, token=token('SUPER_ADMIN'), contract_path='/api/v1/veterinarians/{id}')

    # Existing veterinarian: disabling revokes a prior token; reactivation does not revive it.
    original_vet_path = '/veterinarians/' + sessions['VETERINARIAN']['user']['id']
    edited_original = {key: vets['items'][0][key] for key in vet_update}
    edited_original['baseDegreeTitle'] = 'Medicina veterinaria actualizada'
    degree = request('PUT', original_vet_path, 200, token=token('ADMINISTRATOR'), body=edited_original, contract_path='/api/v1/veterinarians/{id}')
    assert degree['qualifications'][0]['diplomaAvailable'] and not degree['qualifications'][0]['diplomaPublished']
    request('PATCH', original_vet_path + '/status', 200, token=token('ADMINISTRATOR'), body={'status': 'DISABLED'}, contract_path='/api/v1/veterinarians/{id}/status')
    request('GET', '/appointments' + date_query, 401, token=token('VETERINARIAN'), contract_path='/api/v1/appointments')
    request('PATCH', original_vet_path + '/status', 200, token=token('ADMINISTRATOR'), body={'status': 'ACTIVE'}, contract_path='/api/v1/veterinarians/{id}/status')
    request('GET', '/appointments' + date_query, 401, token=token('VETERINARIAN'), contract_path='/api/v1/appointments')
    sessions['VETERINARIAN'] = request('POST', '/auth/sessions', 200, body={'email': 'veterinarian@roles.test', 'password': 'SimulationOnly!2026'}, contract_path='/api/v1/auth/sessions')
    unavailable = request('POST', '/auth/sessions', 200, body={'email': 'unavailable-superadmin@roles.test', 'password': 'SimulationOnly!2026'}, contract_path='/api/v1/auth/sessions')
    request('POST', '/administrators', 503, token=unavailable['accessToken'], body={'email': 'rollback@roles.test', 'fullName': 'Persona Revertida'}, contract_path='/api/v1/administrators', error_code='STAFF_INVITATIONS_UNAVAILABLE')
    after_unavailable = request('GET', '/administrators?size=100', 200, token=token('SUPER_ADMIN'), contract_path='/api/v1/administrators')
    assert not any(item['email'] == 'rollback@roles.test' for item in after_unavailable['items'])

    # SCRUM-37: individual availability administration using the existing Java DTOs.
    schedule_day = (datetime.fromisoformat(today) + timedelta(days=1)).date().isoformat()
    next_day = (datetime.fromisoformat(today) + timedelta(days=2)).date().isoformat()
    third_day = (datetime.fromisoformat(today) + timedelta(days=3)).date().isoformat()
    veterinarian_id = sessions['VETERINARIAN']['user']['id']
    schedule = f'/veterinarians/{veterinarian_id}/availability-slots'
    schedule_contract = '/api/v1/veterinarians/{veterinarianId}/availability-slots'
    slot_contract = schedule_contract + '/{slotId}'
    day_query = '?' + urlencode({'from': schedule_day, 'to': schedule_day})
    for actor in ['OWNER', 'SUPER_ADMIN']:
        request('GET', schedule + day_query, 403, token=token(actor), contract_path=schedule_contract)
        request('POST', schedule, 403, token=token(actor), body={'startsAt': f'{next_day}T09:00:00-05:00'},
                contract_path=schedule_contract)
    request('POST', schedule, 403, token=token('VETERINARIAN'),
            body={'startsAt': f'{next_day}T09:00:00-05:00'}, contract_path=schedule_contract)
    schedule_first = request('GET', schedule + day_query + '&size=2&page=0', 200,
                              token=token('ADMINISTRATOR'), contract_path=schedule_contract)
    schedule_second = request('GET', schedule + day_query + '&size=2&page=1', 200,
                               token=token('ADMINISTRATOR'), contract_path=schedule_contract)
    assert schedule_first['totalElements'] == schedule_second['totalElements'] == 4
    assert len(schedule_first['items']) == len(schedule_second['items']) == 2
    assert not ({item['id'] for item in schedule_first['items']} & {item['id'] for item in schedule_second['items']})
    assert all(item['timeZone'] == 'America/Bogota' for item in schedule_first['items'] + schedule_second['items'])
    own_schedule = request('GET', schedule + day_query, 200, token=token('VETERINARIAN'), contract_path=schedule_contract)
    assert own_schedule['totalElements'] == 4
    blocked_schedule = request('GET', schedule + day_query + '&status=BLOCKED', 200,
                                token=token('ADMINISTRATOR'), contract_path=schedule_contract)
    assert len(blocked_schedule['items']) == 1 and blocked_schedule['items'][0]['status'] == 'BLOCKED'
    request('GET', schedule + day_query + '&size=101', 400, token=token('ADMINISTRATOR'), contract_path=schedule_contract)
    request('GET', schedule + '?from=2026-02-30&to=2026-03-01', 400,
            token=token('ADMINISTRATOR'), contract_path=schedule_contract)
    too_far = (datetime.fromisoformat(schedule_day) + timedelta(days=31)).date().isoformat()
    last_valid_day = (datetime.fromisoformat(schedule_day) + timedelta(days=30)).date().isoformat()
    request('GET', schedule + '?' + urlencode({'from': schedule_day, 'to': last_valid_day}), 200,
            token=token('ADMINISTRATOR'), contract_path=schedule_contract)
    request('GET', schedule + '?' + urlencode({'from': schedule_day, 'to': too_far}), 400,
            token=token('ADMINISTRATOR'), contract_path=schedule_contract, error_code='INVALID_AVAILABILITY_REQUEST')
    request('GET', schedule + '?' + urlencode({'from': next_day, 'to': schedule_day}), 400,
            token=token('ADMINISTRATOR'), contract_path=schedule_contract, error_code='INVALID_AVAILABILITY_REQUEST')
    request('GET', schedule + day_query + '&status=INVALID', 400,
            token=token('ADMINISTRATOR'), contract_path=schedule_contract)
    missing_slot = 'f1000000-0000-4000-8000-999999999999'
    request('GET', schedule + '/' + missing_slot, 404, token=token('ADMINISTRATOR'),
            contract_path=slot_contract, error_code='AVAILABILITY_SLOT_NOT_FOUND')
    request('GET', '/veterinarians/' + missing_id + '/availability-slots' + day_query, 404,
            token=token('ADMINISTRATOR'), contract_path=schedule_contract, error_code='STAFF_RESOURCE_NOT_FOUND')
    other_veterinarian = next(item for item in vets['items'] if item['id'] != veterinarian_id and item['status'] == 'ACTIVE')
    other_schedule = f'/veterinarians/{other_veterinarian["id"]}/availability-slots'
    request('GET', other_schedule + day_query, 404, token=token('VETERINARIAN'),
            contract_path=schedule_contract, error_code='AVAILABILITY_SLOT_NOT_FOUND')
    seeded = request('GET', '/../__simulation/availability?' + urlencode({'email': 'veterinarian@roles.test'}), 200)
    assert seeded['simulationOnly'] is True
    occupied_slot = next(item for item in seeded['slots'] if item['occupiedByAppointment'])
    historical_slot = next(item for item in seeded['slots'] if item['referencedByAppointment'] and not item['occupiedByAppointment'])
    past_slot = next(item for item in seeded['slots'] if item['startsAt'][:10] < today)
    request('GET', other_schedule + '/' + occupied_slot['id'], 404, token=token('ADMINISTRATOR'),
            contract_path=slot_contract, error_code='AVAILABILITY_SLOT_NOT_FOUND')
    request('GET', schedule + '/' + occupied_slot['id'] + '/events', 403,
            token=token('VETERINARIAN'), contract_path=slot_contract + '/events')
    request('GET', schedule + '/' + occupied_slot['id'], 200,
            token=token('VETERINARIAN'), contract_path=slot_contract)
    request('PATCH', schedule + '/' + occupied_slot['id'] + '/status', 409, token=token('ADMINISTRATOR'),
            body={'status': 'BLOCKED', 'expectedVersion': occupied_slot['version'], 'reason': 'Prueba de ocupación'},
            contract_path=slot_contract + '/status', error_code='AVAILABILITY_SLOT_OCCUPIED_BY_APPOINTMENT')
    request('PUT', schedule + '/' + historical_slot['id'], 409, token=token('ADMINISTRATOR'),
            body={'startsAt': f'{next_day}T13:00:00-05:00', 'expectedVersion': historical_slot['version'], 'reason': 'Prueba de historia'},
            contract_path=slot_contract, error_code='AVAILABILITY_SLOT_REFERENCED_BY_APPOINTMENT')
    # An unchanged start does not move even a referenced slot or append an event.
    unchanged_history = request('PUT', schedule + '/' + historical_slot['id'], 200, token=token('ADMINISTRATOR'),
                                 body={'startsAt': historical_slot['startsAt'], 'expectedVersion': historical_slot['version'], 'reason': 'Sin cambio efectivo'},
                                 contract_path=slot_contract)
    assert unchanged_history['version'] == historical_slot['version']
    request('PUT', schedule + '/' + past_slot['id'], 409, token=token('ADMINISTRATOR'),
            body={'startsAt': f'{next_day}T13:00:00-05:00', 'expectedVersion': past_slot['version'], 'reason': 'Intento pasado'},
            contract_path=slot_contract, error_code='AVAILABILITY_SLOT_NOT_EDITABLE')
    inactive_veterinarian = next(item for item in vets['items'] if item['status'] == 'DISABLED')
    request('POST', f'/veterinarians/{inactive_veterinarian["id"]}/availability-slots', 409,
            token=token('ADMINISTRATOR'), body={'startsAt': f'{next_day}T09:00:00-05:00'},
            contract_path=schedule_contract, error_code='VETERINARIAN_NOT_ACTIVE')
    request('POST', schedule, 409, token=token('ADMINISTRATOR'), body={'startsAt': f'{today}T00:00:00-05:00'},
            contract_path=schedule_contract, error_code='AVAILABILITY_SLOT_NOT_EDITABLE')
    # Administration may publish today; the owner-only advance window is a different rule.
    next_grid_time = datetime.fromtimestamp((int(datetime.now(timezone.utc).timestamp()) // 1800 + 1) * 1800,
                                            tz=timezone.utc)
    if next_grid_time.astimezone(timezone(timedelta(hours=-5))).date().isoformat() == today:
        request('POST', schedule, 201, token=token('ADMINISTRATOR'),
                body={'startsAt': next_grid_time.isoformat()}, contract_path=schedule_contract)
    for invalid_start, code in [(1234, 'TYPE_MISMATCH'), (f'{next_day}T09:00:00', 'TYPE_MISMATCH'),
                                 (f'{next_day}T09:15:00-05:00', 'INVALID_AVAILABILITY_REQUEST'),
                                 (f'{next_day}T09:00:00.0001-05:00', 'INVALID_AVAILABILITY_REQUEST')]:
        request('POST', schedule, 400, token=token('ADMINISTRATOR'), body={'startsAt': invalid_start},
                contract_path=schedule_contract, error_code=code)
    request('POST', schedule, 400, token=token('ADMINISTRATOR'), body={},
            contract_path=schedule_contract, error_code='VALIDATION_FAILED')
    created_slot = request('POST', schedule, 201, token=token('ADMINISTRATOR'),
                            body={'startsAt': f'{next_day}T09:00:00-05:00'}, contract_path=schedule_contract)
    assert created_slot['startsAt'] == f'{next_day}T14:00:00.000Z' and created_slot['version'] == 0
    created_path = schedule + '/' + created_slot['id']
    create_events = request('GET', created_path + '/events', 200, token=token('ADMINISTRATOR'), contract_path=slot_contract + '/events')
    assert len(create_events['items']) == 1 and create_events['items'][0]['eventType'] == 'CREATED'
    assert all(create_events['items'][0][field] is None for field in ['previousStartsAt', 'previousEndsAt', 'previousStatus', 'reason'])
    request('POST', schedule, 409, token=token('ADMINISTRATOR'), body={'startsAt': f'{next_day}T14:00:00Z'},
            contract_path=schedule_contract, error_code='AVAILABILITY_SLOT_CONFLICT')
    request('POST', schedule, 201, token=token('ADMINISTRATOR'), body={'startsAt': f'{next_day}T09:30:00-05:00'},
            contract_path=schedule_contract)
    request('PUT', created_path, 409, token=token('ADMINISTRATOR'),
            body={'startsAt': f'{next_day}T09:30:00-05:00', 'expectedVersion': 0, 'reason': 'Colisión'},
            contract_path=slot_contract, error_code='AVAILABILITY_SLOT_CONFLICT')
    for version in ['0', 0.5, True]:
        request('PUT', created_path, 400, token=token('ADMINISTRATOR'),
                body={'startsAt': f'{next_day}T11:00:00-05:00', 'expectedVersion': version, 'reason': 'Tipo inválido'},
                contract_path=slot_contract, error_code='TYPE_MISMATCH')
    for reason in [' ', 'a' * 501]:
        invalid_reason = request('PUT', created_path, 400, token=token('ADMINISTRATOR'),
                                   body={'startsAt': f'{next_day}T11:00:00-05:00', 'expectedVersion': 0, 'reason': reason},
                                   contract_path=slot_contract, error_code='VALIDATION_FAILED')
        assert any(item['field'] == 'reason' for item in invalid_reason['fieldErrors'])
    moved_slot = request('PUT', created_path, 200, token=token('ADMINISTRATOR'),
                          body={'startsAt': f'{next_day}T11:00:00-05:00', 'expectedVersion': 0, 'reason': '  Ajuste ficticio  '},
                          contract_path=slot_contract)
    assert moved_slot['id'] == created_slot['id'] and moved_slot['version'] == 1
    request('PATCH', created_path + '/status', 409, token=token('ADMINISTRATOR'),
            body={'status': 'BLOCKED', 'expectedVersion': 0, 'reason': 'Versión anterior'},
            contract_path=slot_contract + '/status', error_code='CONCURRENT_UPDATE')
    request('PATCH', created_path + '/status', 400, token=token('ADMINISTRATOR'),
            body={'status': 'DISABLED', 'expectedVersion': 1, 'reason': 'Estado incorrecto'},
            contract_path=slot_contract + '/status', error_code='TYPE_MISMATCH')
    blocked_slot = request('PATCH', created_path + '/status', 200, token=token('ADMINISTRATOR'),
                            body={'status': 'BLOCKED', 'expectedVersion': 1, 'reason': 'Bloqueo ficticio'},
                            contract_path=slot_contract + '/status')
    assert blocked_slot['status'] == 'BLOCKED' and blocked_slot['version'] == 2
    same_status = request('PATCH', created_path + '/status', 200, token=token('ADMINISTRATOR'),
                           body={'status': 'BLOCKED', 'expectedVersion': 2, 'reason': 'Sin cambio efectivo'},
                           contract_path=slot_contract + '/status')
    assert same_status['version'] == 2
    request('POST', schedule, 409, token=token('ADMINISTRATOR'), body={'startsAt': blocked_slot['startsAt']},
            contract_path=schedule_contract, error_code='AVAILABILITY_SLOT_CONFLICT')
    republished_slot = request('PATCH', created_path + '/status', 200, token=token('ADMINISTRATOR'),
                                body={'status': 'PUBLISHED', 'expectedVersion': 2, 'reason': 'Publicación ficticia'},
                                contract_path=slot_contract + '/status')
    assert republished_slot['id'] == created_slot['id'] and republished_slot['version'] == 3
    history_page = request('GET', created_path + '/events?size=2&page=1', 200,
                             token=token('ADMINISTRATOR'), contract_path=slot_contract + '/events')
    assert history_page['totalElements'] == 4 and [event['slotVersion'] for event in history_page['items']] == [2, 3]
    history = request('GET', created_path + '/events', 200, token=token('ADMINISTRATOR'), contract_path=slot_contract + '/events')
    assert [event['eventType'] for event in history['items']] == ['CREATED', 'RESCHEDULED', 'BLOCKED', 'PUBLISHED']
    assert history['items'][1]['reason'] == 'Ajuste ficticio' and all(event['actorId'] == sessions['ADMINISTRATOR']['user']['id'] for event in history['items'])
    unchanged_boundary = request('PUT', created_path, 200, token=token('ADMINISTRATOR'),
                                  body={'startsAt': republished_slot['startsAt'], 'expectedVersion': 3, 'reason': 'a' * 500},
                                  contract_path=slot_contract)
    assert unchanged_boundary['version'] == 3
    fixture('availability-state', slotId=created_slot['id'], occupied=True, referenced=True)
    request('PATCH', created_path + '/status', 409, token=token('ADMINISTRATOR'),
            body={'status': 'BLOCKED', 'expectedVersion': 3, 'reason': 'Ocupación controlada'},
            contract_path=slot_contract + '/status', error_code='AVAILABILITY_SLOT_OCCUPIED_BY_APPOINTMENT')
    request('PUT', created_path, 409, token=token('ADMINISTRATOR'),
            body={'startsAt': f'{next_day}T13:00:00-05:00', 'expectedVersion': 3, 'reason': 'Referencia controlada'},
            contract_path=slot_contract, error_code='AVAILABILITY_SLOT_REFERENCED_BY_APPOINTMENT')
    fixture('availability-state', slotId=created_slot['id'], occupied=False, referenced=False)
    available_query = '?' + urlencode({'from': schedule_day, 'to': next_day, 'veterinarianId': veterinarian_id})
    owner_options = request('GET', '/availability-slots' + available_query, 200,
                              token=token('OWNER'), contract_path='/api/v1/availability-slots')
    assert created_slot['id'] in {item['id'] for item in owner_options['items']}
    assert occupied_slot['id'] not in {item['id'] for item in owner_options['items']}
    assert blocked_schedule['items'][0]['id'] not in {item['id'] for item in owner_options['items']}
    other_slot = request('POST', other_schedule, 201, token=token('ADMINISTRATOR'),
                          body={'startsAt': f'{third_day}T09:00:00-05:00'}, contract_path=schedule_contract)
    other_status_path = f'/veterinarians/{other_veterinarian["id"]}/status'
    request('PATCH', other_status_path, 200, token=token('ADMINISTRATOR'), body={'status': 'DISABLED'},
            contract_path='/api/v1/veterinarians/{id}/status')
    request('PUT', other_schedule + '/' + other_slot['id'], 409, token=token('ADMINISTRATOR'),
            body={'startsAt': f'{third_day}T10:00:00-05:00', 'expectedVersion': 0, 'reason': 'Profesional inactivo'},
            contract_path=slot_contract, error_code='VETERINARIAN_NOT_ACTIVE')
    request('PATCH', other_schedule + '/' + other_slot['id'] + '/status', 200, token=token('ADMINISTRATOR'),
            body={'status': 'BLOCKED', 'expectedVersion': 0, 'reason': 'Retiro permitido de turno futuro'},
            contract_path=slot_contract + '/status')
    request('PATCH', other_schedule + '/' + other_slot['id'] + '/status', 409, token=token('ADMINISTRATOR'),
            body={'status': 'PUBLISHED', 'expectedVersion': 1, 'reason': 'Profesional inactivo'},
            contract_path=slot_contract + '/status', error_code='VETERINARIAN_NOT_ACTIVE')
    request('PATCH', other_status_path, 200, token=token('ADMINISTRATOR'), body={'status': 'ACTIVE'},
            contract_path='/api/v1/veterinarians/{id}/status')
    expired_administrator = request('POST', '/auth/sessions', 200,
                                     body={'email': 'administrator@roles.test', 'password': 'SimulationOnly!2026'},
                                     contract_path='/api/v1/auth/sessions')
    request('DELETE', '/auth/sessions/current', 204, token=expired_administrator['accessToken'], contract_path='/api/v1/auth/sessions/current')
    request('GET', schedule + day_query, 401, token=expired_administrator['accessToken'], contract_path=schedule_contract)
    request('POST', schedule, 401, token=expired_administrator['accessToken'],
            body={'startsAt': f'{third_day}T11:00:00-05:00'}, contract_path=schedule_contract)
    fixture('next-mutation', drop=True)
    dropped_slot_body = {'startsAt': f'{third_day}T12:00:00-05:00'}
    # This controlled write includes its administrator token, without storing it in the report.
    lost_slot_request = Request(args.base_url.rstrip('/') + schedule, data=json.dumps(dropped_slot_body).encode(),
                                headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token('ADMINISTRATOR')}, method='POST')
    try:
        with urlopen(lost_slot_request, timeout=10) as response:
            raise AssertionError(f'La respuesta de creación perdida no debe producir {response.status}')
    except HTTPError as error:
        assert error.code == 502
        error.close()
        checks.append({'method': 'POST', 'path': schedule, 'status': 502, 'schemaValidated': False,
                       'injectedFailure': 'response-dropped-after-availability-created'})
    reconciled_day = request('GET', schedule + '?' + urlencode({'from': third_day, 'to': third_day}), 200,
                              token=token('ADMINISTRATOR'), contract_path=schedule_contract)
    assert len(reconciled_day['items']) == 1 and reconciled_day['items'][0]['startsAt'] == f'{third_day}T17:00:00.000Z'

    for role, destination in [('OWNER', '/users/me'), ('SUPER_ADMIN', '/administrators'),
                              ('ADMINISTRATOR', '/veterinarians'), ('VETERINARIAN', '/appointments' + date_query)]:
        request('DELETE', '/auth/sessions/current', 204, token=token(role), contract_path='/api/v1/auth/sessions/current')
        request('GET', destination, 401, token=token(role), contract_path='/api/v1' + destination.split('?')[0])

    # A selector must find all active pets even when the account has more than one page.
    paginated_owner = request('POST', '/auth/sessions', 200,
                               body={'email': 'owner@roles.test', 'password': 'SimulationOnly!2026'},
                               contract_path='/api/v1/auth/sessions')
    fixture('expand-pets', email='owner@roles.test')
    pet_pages = [request('GET', f'/pets?page={page}&size=20&active=true', 200,
                         token=paginated_owner['accessToken'], contract_path='/api/v1/pets')
                 for page in range(2)]
    assert [len(page['items']) for page in pet_pages] == [20, 5]
    assert all(page['totalElements'] == 25 and page['totalPages'] == 2 for page in pet_pages)
    active_pets = [pet for page in pet_pages for pet in page['items']]
    assert len({pet['id'] for pet in active_pets}) == 25 and all(pet['active'] for pet in active_pets)

    # Leave a fresh deterministic environment for the real browser checks.
    request('POST', '/../__simulation/reset', 204)
    report = {'simulationOnly': True, 'contractVersion': spec['info']['version'],
              'checkedAtUtc': datetime.now(timezone.utc).isoformat(), 'requestsChecked': len(checks), 'checks': checks}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(checks)} peticiones HTTP verificadas contra la simulación local; esquemas del contrato {spec["info"]["version"]}.')
    print(f'Informe sin tokens: {args.report}')


if __name__ == '__main__':
    main()
