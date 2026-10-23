"""Verify administrative notifications over the fixed local HTTP simulation.

Requires exclusive access to port 4900; resets fictitious data on entry/exit.
Product traffic is GET-only. Login and explicit local fixtures are separate.
The report includes request metadata, never tokens, bodies or recipient data.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from jsonschema import Draft202012Validator, FormatChecker, ValidationError


BASE_URL = "http://127.0.0.1:4900/api/v1"
APPOINTMENT_ID = "d1000000-0000-4000-8000-000000000003"
EMPTY_APPOINTMENT_ID = "d1000000-0000-4000-8000-000000000004"
DETAIL_CONTRACT = "/api/v1/appointments/{appointmentId}"
NOTIFICATIONS_CONTRACT = DETAIL_CONTRACT + "/notifications"
FIELDS = {
    "id", "appointmentId", "notificationType", "status", "scheduledAt",
    "nextAttemptAt", "sentAt", "attemptCount", "errorCode",
}
TYPES = {
    "ADMIN_REASSIGNMENT", "OWNER_REASSIGNED", "OWNER_CONFIRMED",
    "OWNER_REJECTED", "OWNER_CANCELLED", "OWNER_RESCHEDULED", "OWNER_REMINDER",
}
STATES = {"PENDING", "SENDING", "SENT", "FAILED", "SUPERSEDED"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument(
        "--report", type=Path,
        default=Path(__file__).parents[1] / ".runtime/administrative-notifications-http.json",
    )
    args = parser.parse_args()
    spec = json.loads(args.spec.read_text(encoding="utf-8-sig"))
    checks: list[dict] = []
    tokens: dict[str, str] = {}

    def request(method, path, expected, *, actor="admin", body=None,
                contract=None, code=None, invalid=None):
        assert path.startswith("/") and "://" not in path
        assert method == "GET" or path == "/auth/sessions" or path.startswith("/../__simulation/")
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if actor is not None and actor in tokens:
            headers["Authorization"] = "Bearer " + tokens[actor]
        req = Request(
            BASE_URL + path, method=method, headers=headers,
            data=None if body is None else json.dumps(body).encode("utf-8"),
        )
        try:
            response = urlopen(req, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            assert response.status == expected, (
                f"{method} {path}: HTTP {response.status}, expected {expected}"
            )
            assert "no-store" in {
                part.strip() for part in response.headers.get("Cache-Control", "").split(",")
            }
            media = "application/problem+json" if expected >= 400 else "application/json"
            assert response.headers.get_content_type() == media
            raw = response.read()
        entry = {"method": method, "path": path, "status": expected, "schemaValidated": False}
        if invalid == "invalid-json":
            try:
                json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                entry["expectedInvalidJsonObserved"] = True
                checks.append(entry)
                return None
            raise AssertionError("The explicit invalid-JSON fixture returned valid JSON.")
        result = json.loads(raw) if raw else None
        if code:
            assert result["errorCode"] == code
        if contract:
            content = spec["paths"][contract][method.lower()]["responses"][str(expected)].get("content")
            assert content and media in content
            schema = {**content[media]["schema"], "components": spec["components"]}
            validator = Draft202012Validator(schema, format_checker=FormatChecker())
            if invalid == "extra-field":
                try:
                    validator.validate(result)
                except ValidationError:
                    entry["expectedSchemaViolationObserved"] = True
                else:
                    raise AssertionError("The explicit extra-field fixture passed the DTO schema.")
            else:
                validator.validate(result)
                entry["schemaValidated"] = True
        if invalid == "foreign":
            assert any(item["appointmentId"] != APPOINTMENT_ID for item in result["items"])
            entry["expectedForeignAppointmentObserved"] = True
        checks.append(entry)
        return result

    def fixture(action, **values):
        return request(
            "POST", "/../__simulation/fixture", 204, actor=None,
            body={"action": action, **values},
        )

    def notifications(query="", *, appointment_id=APPOINTMENT_ID, actor="admin",
                      expected=200, code=None, invalid=None, contract=True):
        return request(
            "GET", "/appointments/" + appointment_id + "/notifications" + query,
            expected, actor=actor, code=code, invalid=invalid,
            contract=NOTIFICATIONS_CONTRACT if contract else None,
        )

    def detail():
        return request(
            "GET", "/appointments/" + APPOINTMENT_ID, 200,
            contract=DETAIL_CONTRACT,
        )

    def assert_dto(items):
        for item in items:
            assert set(item) == FIELDS
            assert item["appointmentId"] == APPOINTMENT_ID
            assert item["notificationType"] in TYPES
            assert item["status"] in STATES
            assert isinstance(item["attemptCount"], int) and not isinstance(item["attemptCount"], bool)
            assert item["attemptCount"] >= 0
            if item["status"] != "PENDING":
                assert item["nextAttemptAt"] is None
            for field in ("nextAttemptAt", "sentAt", "errorCode"):
                assert field in item
        assert len({item["id"] for item in items}) == len(items)

    request("POST", "/../__simulation/reset", 204, actor=None)
    try:
        fixture(
            "prepare-appointment-notifications",
            appointmentId=APPOINTMENT_ID, count=26,
        )
        for actor, email in (
            ("admin", "administrator"), ("readonly", "read-only-administrator"),
            ("owner", "owner"), ("other_owner", "other-owner"),
            ("veterinarian", "veterinarian"), ("superadmin", "superadmin"),
        ):
            login = request(
                "POST", "/auth/sessions", 200, actor=None, body={
                    "email": email + "@roles.test", "password": "SimulationOnly!2026",
                }, contract="/api/v1/auth/sessions",
            )
            tokens[actor] = login["accessToken"]
            if actor == "readonly":
                assert login["user"]["role"] == "ADMINISTRATOR"
                assert "APPOINTMENT_READ_ALL" in login["user"]["permissions"]
                assert "APPOINTMENT_MANAGE" not in login["user"]["permissions"]

        source = detail()
        notifications(expected=401, actor=None)
        notifications(expected=403, actor="veterinarian", code="ACCESS_DENIED")
        notifications(expected=403, actor="superadmin", code="ACCESS_DENIED")
        notifications(expected=404, actor="other_owner", code="APPOINTMENT_NOT_FOUND")

        first = notifications("?page=0&size=20")
        second = notifications("?page=1&size=20")
        assert first["page"] == 0 and second["page"] == 1
        assert first["size"] == second["size"] == 20
        assert first["totalElements"] == second["totalElements"] == 26
        assert first["totalPages"] == second["totalPages"] == 2
        assert len(first["items"]) == 20 and len(second["items"]) == 6
        combined = first["items"] + second["items"]
        assert_dto(combined)
        assert {item["notificationType"] for item in combined} == TYPES
        assert {item["status"] for item in combined} == STATES
        assert any(item["nextAttemptAt"] is None for item in combined)
        assert any(item["sentAt"] is None for item in combined)
        assert any(item["errorCode"] is None for item in combined)
        assert notifications("?page=0&size=20", actor="readonly") == first

        owner_first = notifications("?page=0&size=20", actor="owner")
        owner_second = notifications("?page=1&size=20", actor="owner")
        assert owner_first["totalElements"] == owner_second["totalElements"] == 25
        assert len(owner_first["items"]) == 20 and len(owner_second["items"]) == 5
        owner_items = owner_first["items"] + owner_second["items"]
        assert_dto(owner_items)
        assert all(item["notificationType"] != "ADMIN_REASSIGNMENT" for item in owner_items)
        internal_ids = {
            item["id"] for item in combined if item["notificationType"] == "ADMIN_REASSIGNMENT"
        }
        assert {item["id"] for item in combined} - {item["id"] for item in owner_items} == internal_ids

        empty = notifications(appointment_id=EMPTY_APPOINTMENT_ID)
        assert empty["items"] == [] and empty["totalElements"] == empty["totalPages"] == 0
        beyond = notifications("?page=2&size=20")
        assert beyond["items"] == [] and beyond["page"] == 2
        assert beyond["totalElements"] == 26 and beyond["totalPages"] == 2
        notifications("?page=-1&size=20", expected=400)
        notifications("?page=0&size=101", expected=400)
        notifications(
            appointment_id="d1000000-0000-4000-8000-000000000999",
            expected=404, code="APPOINTMENT_NOT_FOUND",
        )
        assert detail() == source

        # The following are explicit local fault fixtures, not production responses.
        fixture("next-notification-read", appointmentId=APPOINTMENT_ID, mode="unavailable")
        notifications(
            expected=503, code="SIMULATION_TEMPORARY_UNAVAILABLE", contract=False,
        )
        assert notifications("?page=0&size=20") == first  # one-shot fault consumed
        fixture("next-notification-read", appointmentId=APPOINTMENT_ID, mode="invalid-json")
        notifications(invalid="invalid-json", contract=False)
        fixture("next-notification-read", appointmentId=APPOINTMENT_ID, mode="extra-field")
        notifications(invalid="extra-field")
        fixture("next-notification-read", appointmentId=APPOINTMENT_ID, mode="foreign")
        notifications(invalid="foreign")
    finally:
        request("POST", "/../__simulation/reset", 204, actor=None)

    assert 25 <= len(checks) <= 35, "Keep the local verifier focused."
    product = [
        item for item in checks
        if not item["path"].startswith("/../__simulation/") and item["path"] != "/auth/sessions"
    ]
    assert all(item["method"] == "GET" for item in product)
    report = {
        "simulationOnly": True,
        "checkedAtUtc": datetime.now(timezone.utc).isoformat(),
        "openApiVersion": spec["info"]["version"],
        "requestCount": len(checks),
        "schemaValidatedCount": sum(item["schemaValidated"] for item in checks),
        "productGetCount": len(product),
        "productMutationCount": 0,
        "scope": [
            "six role/permission profiles, including administrator read-only",
            "26 administrative entries in20+6 and25 owner entries excluding the administrator recipient",
            "strict nine-field DTO, all seven types and five statuses, nullable fields",
            "empty appointment, page beyond total, invalid pagination and inaccessible/missing resources",
            "appointment detail unchanged by the read-only workflow",
            "one-shot unavailable, invalid JSON, additional field and foreign appointment fixtures",
        ],
        "limits": [
            "Local stand-in, not authenticated production RBAC or real database/SMTP evidence.",
            "Intentional malformed/extra/foreign fixture responses are distinguished from conforming responses.",
            "No product POST/PATCH/PUT/DELETE, SMTP, resend or scheduling mutation.",
            "Reset and fixture POST requests affect only fictitious local data; login creates local sessions.",
        ],
        "checks": checks,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"{len(checks)} requests, {report['schemaValidatedCount']} schemas, "
        f"{len(product)} product GET; final reset applied; simulation only."
    )


if __name__ == "__main__":
    main()
