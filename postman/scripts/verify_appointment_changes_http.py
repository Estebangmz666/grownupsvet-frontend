"""Check appointment changes over HTTP against the fixed local simulation.

Requires exclusive use of 127.0.0.1:4900: resets fictitious data on entry/exit.
Response schemas come from the supplied OpenAPI snapshot. The report retains
only request metadata; it does not contain tokens, payloads or response bodies.
This verifies the stand-in, not PostgreSQL transactions or real SMTP delivery.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

from jsonschema import Draft202012Validator, FormatChecker


BASE_URL = "http://127.0.0.1:4900/api/v1"
APPOINTMENTS = "/api/v1/appointments"
DETAIL = APPOINTMENTS + "/{appointmentId}"
EVENTS = DETAIL + "/events"
STATUS = DETAIL + "/status"
RESCHEDULE = DETAIL + "/reschedulings"
REASSIGN = DETAIL + "/veterinarian-reassignments"
SLOTS = "/api/v1/veterinarians/{veterinarianId}/availability-slots"
AVAILABLE = "/api/v1/availability-slots"
BOGOTA = timezone(timedelta(hours=-5))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument(
        "--report", type=Path,
        default=Path(__file__).parents[1] / ".runtime/appointment-changes-http.json",
    )
    args = parser.parse_args()
    spec = json.loads(args.spec.read_text(encoding="utf-8-sig"))
    checks: list[dict] = []
    tokens: dict[str, str] = {}
    today = datetime.now(BOGOTA).date()
    tomorrow = (today + timedelta(days=1)).isoformat()
    third_day = (today + timedelta(days=3)).isoformat()
    far_day = (today + timedelta(days=70)).isoformat()
    contacted_day = (today - timedelta(days=1)).isoformat()

    def request(method, path, expected, *, actor="admin", body=None,
                contract=None, code=None):
        assert path.startswith("/") and "://" not in path
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
            assert response.headers.get("Cache-Control") == "no-store"
            media = "application/problem+json" if expected >= 400 else "application/json"
            assert response.headers.get_content_type() == media
            raw = response.read()
            result = json.loads(raw) if raw else None
        if code:
            assert result["errorCode"] == code, (
                f"{method} {path}: code {result.get('errorCode')}, expected {code}"
            )
        validated = False
        if contract:
            content = spec["paths"][contract][method.lower()]["responses"][str(expected)].get("content")
            assert content and media in content, "Expected a documented response schema."
            schema = {**content[media]["schema"], "components": spec["components"]}
            Draft202012Validator(schema, format_checker=FormatChecker()).validate(result)
            validated = True
        checks.append({
            "method": method, "path": path, "status": expected,
            "schemaValidated": validated,
        })
        return result

    def fixture(action, **values):
        return request(
            "POST", "/../__simulation/fixture", 204, actor=None,
            body={"action": action, **values},
        )

    def appointment_path(appointment):
        return "/appointments/" + appointment["id"]

    def detail(appointment):
        return request("GET", appointment_path(appointment), 200, contract=DETAIL)

    def events(appointment):
        result = request(
            "GET", appointment_path(appointment) + "/events?size=100", 200,
            contract=EVENTS,
        )
        assert result["totalElements"] == len(result["items"])
        keys = [(event["occurredAt"], event["id"]) for event in result["items"]]
        assert keys == sorted(keys)
        return result

    def change_status(appointment, target, expected=200, *, reason="Cambio acordado",
                      actor="admin", code=None):
        body = {"status": target, "expectedVersion": appointment["version"]}
        if reason is not None:
            body["reason"] = reason
        return request(
            "PATCH", appointment_path(appointment) + "/status", expected,
            actor=actor, body=body, contract=STATUS, code=code,
        )

    def candidate_page(veterinarian_id, day):
        query = urlencode({
            "from": day, "to": day, "status": "PUBLISHED", "size": 100,
        })
        return request(
            "GET", "/veterinarians/" + veterinarian_id + "/availability-slots?" + query,
            200, contract=SLOTS,
        )["items"]

    def owner_options(appointment):
        query = urlencode({
            "from": tomorrow, "to": tomorrow,
            "veterinarianId": appointment["veterinarianId"], "size": 100,
        })
        return request(
            "GET", "/availability-slots?" + query, 200, actor="owner",
            contract=AVAILABLE,
        )["items"]

    def intent(appointment, destination, *, agreement=True):
        body = {
            "clientRequestId": str(uuid4()),
            "availabilitySlotId": destination["id"],
            "expectedAvailabilitySlotVersion": destination["version"],
            "expectedVersion": appointment["version"],
            "reason": "  Cambio administrativo de simulación  ",
        }
        if agreement:
            body.update({
                "agreementChannel": "PHONE",
                "agreementContactedAt": contacted_day + "T14:00:00.123456789Z",
                "agreementNote": "  El propietario acordó este horario.  ",
            })
        return body

    def move(appointment, operation, body, expected=200, *, actor="admin", code=None):
        suffix, contract = (
            ("reschedulings", RESCHEDULE) if operation == "RESCHEDULING"
            else ("veterinarian-reassignments", REASSIGN)
        )
        return request(
            "POST", appointment_path(appointment) + "/" + suffix, expected,
            actor=actor, body=body, contract=contract, code=code,
        )

    def same_identity(before, after):
        for key in ("id", "ownerId", "petId"):
            assert after[key] == before[key]
        assert "email" not in after and "ownerEmail" not in after

    def moved(before, after, destination):
        same_identity(before, after)
        assert after["status"] == before["status"]
        assert after["assignmentStatus"] == "ASSIGNED"
        assert after["veterinarianId"] == destination["veterinarianId"]
        assert datetime.fromisoformat(after["startsAt"].replace("Z", "+00:00")) == datetime.fromisoformat(destination["startsAt"].replace("Z", "+00:00"))
        assert after["version"] == before["version"] + 1

    request("POST", "/../__simulation/reset", 204, actor=None)
    try:
        fixture("prepare-appointment-changes")
        for actor, email in (
            ("admin", "administrator"), ("other_admin", "flaky-administrator"),
            ("owner", "owner"),
        ):
            tokens[actor] = request(
                "POST", "/auth/sessions", 200, actor=None, body={
                    "email": email + "@roles.test", "password": "SimulationOnly!2026",
                }, contract="/api/v1/auth/sessions",
            )["accessToken"]

        page = request(
            "GET", "/appointments?" + urlencode({
                "from": tomorrow, "to": tomorrow, "size": 100,
            }), 200, contract=APPOINTMENTS,
        )
        assert len(page["items"]) == page["totalElements"] == 25
        requested = [
            item for item in page["items"]
            if item["status"] == "REQUESTED" and item["assignmentStatus"] == "ASSIGNED"
        ]
        confirmed = [item for item in page["items"] if item["status"] == "CONFIRMED"]
        first_vet = confirmed[0]["veterinarianId"]
        second_vet = next(
            item["veterinarianId"] for item in requested
            if item["veterinarianId"] != first_vet
        )
        first_candidates = candidate_page(first_vet, third_day)
        second_candidates = candidate_page(second_vet, third_day)
        far_candidate = candidate_page(first_vet, far_day)[0]
        assert len(first_candidates) == len(second_candidates) == 25

        # Cancel a pending request: reason, permissions, replay and released capacity.
        cancel_source = requested[0]
        original_slot = events(cancel_source)["items"][0]["newSlotId"]
        assert original_slot not in {slot["id"] for slot in owner_options(cancel_source)}
        change_status(cancel_source, "CANCELLED", 403, actor="owner")
        change_status(cancel_source, "CANCELLED", 400, reason=" \t ",
                      code="INVALID_APPOINTMENT_REQUEST")
        fixture("appointment-state", appointmentId=cancel_source["id"], participantInactive=True)
        cancelled = change_status(cancel_source, "CANCELLED")
        same_identity(cancel_source, cancelled)
        assert cancelled["status"] == "CANCELLED"
        assert change_status(cancel_source, "CANCELLED") == cancelled
        assert original_slot in {slot["id"] for slot in owner_options(cancel_source)}
        change_status(cancelled, "NO_SHOW", 409, code="APPOINTMENT_TRANSITION_NOT_ALLOWED")

        # No-show is unavailable before the end and remains valid with inactive participants.
        no_show_source = confirmed[0]
        change_status(no_show_source, "NO_SHOW", 409, code="APPOINTMENT_NOT_ENDED")
        fixture("appointment-state", appointmentId=no_show_source["id"],
                timing="ENDED", participantInactive=True)
        change_status(no_show_source, "CANCELLED", 409, code="APPOINTMENT_ALREADY_STARTED")
        no_show = change_status(no_show_source, "NO_SHOW")
        assert no_show["status"] == "NO_SHOW"
        assert change_status(no_show_source, "NO_SHOW") == no_show
        assert any(
            event["eventType"] == "NO_SHOW" and event["actorType"] == "HUMAN"
            and event["reason"] == "Cambio acordado"
            for event in events(no_show)["items"]
        )

        # Invalid moves preserve both source detail and history.
        normal_source = next(
            item for item in requested
            if item["id"] != cancel_source["id"] and item["veterinarianId"] == first_vet
        )
        normal_history = events(normal_source)
        destination = first_candidates[1]
        normal_body = intent(normal_source, destination)
        fixture("availability-state", slotId=destination["id"], occupied=True, referenced=True)
        move(normal_source, "RESCHEDULING", normal_body, 409, code="APPOINTMENT_SLOT_OCCUPIED")
        fixture("availability-state", slotId=destination["id"], occupied=False, referenced=True)
        move(normal_source, "RESCHEDULING", {
            **normal_body, "expectedAvailabilitySlotVersion": destination["version"] + 1,
        }, 409, code="CONCURRENT_UPDATE")
        move(normal_source, "RESCHEDULING", {
            **normal_body, "availabilitySlotId": str(uuid4()),
        }, 409, code="APPOINTMENT_SLOT_NOT_AVAILABLE")
        fixture("appointment-state", appointmentId=normal_source["id"], cutoffPassed=True)
        move(normal_source, "RESCHEDULING", normal_body, 409,
             code="APPOINTMENT_CONFIRMATION_CUTOFF_PASSED")
        fixture("appointment-state", appointmentId=normal_source["id"], cutoffPassed=False)
        move(normal_source, "RESCHEDULING", intent(normal_source, destination, agreement=False),
             400, code="VALIDATION_FAILED")
        move(normal_source, "RESCHEDULING", {
            **normal_body, "agreementContactedAt": contacted_day + "T12:00:00+19:00",
        }, 400, code="TYPE_MISMATCH")
        move(normal_source, "RESCHEDULING", {
            **normal_body,
            "agreementContactedAt": (today + timedelta(days=1)).isoformat() + "T14:00:00Z",
        }, 400, code="INVALID_APPOINTMENT_REQUEST")
        move(normal_source, "RESCHEDULING", {
            **normal_body, "availabilitySlotId": far_candidate["id"],
            "expectedAvailabilitySlotVersion": far_candidate["version"],
        }, 409, code="APPOINTMENT_OUTSIDE_REQUEST_WINDOW")
        assert detail(normal_source) == normal_source
        assert events(normal_source) == normal_history

        rescheduled = move(normal_source, "RESCHEDULING", normal_body)
        moved(normal_source, rescheduled, destination)
        assert move(normal_source, "RESCHEDULING", {
            **normal_body,
            "agreementContactedAt": contacted_day + "T09:00:00.123456789-05:00",
        }) == rescheduled
        move(normal_source, "RESCHEDULING", {
            **normal_body,
            "agreementContactedAt": contacted_day + "T14:00:00.123456788Z",
        }, 409, code="APPOINTMENT_IDEMPOTENCY_CONFLICT")
        move(normal_source, "RESCHEDULING", normal_body, 409, actor="other_admin",
             code="APPOINTMENT_IDEMPOTENCY_CONFLICT")
        cancelled_move = change_status(rescheduled, "CANCELLED")
        # Persistent POST replay returns current state, not its old destination/version.
        assert move(normal_source, "RESCHEDULING", normal_body) == cancelled_move
        normal_events = events(cancelled_move)
        assert normal_events["totalElements"] == 3
        assert sum(event["eventType"] == "RESCHEDULED" for event in normal_events["items"]) == 1

        # Resolve NEEDS_REASSIGNMENT at the same instant without a contact agreement.
        same_source = confirmed[1]
        same_destination = first_candidates[5]
        same_source = move(same_source, "RESCHEDULING", intent(same_source, same_destination))
        fixture("appointment-veterinarian-unavailable", appointmentId=same_source["id"])
        unavailable = detail(same_source)
        assert unavailable["assignmentStatus"] == "NEEDS_REASSIGNMENT"
        matching = next(
            slot for slot in second_candidates
            if slot["startsAt"] == same_destination["startsAt"]
        )
        move(unavailable, "RESCHEDULING", intent(unavailable, matching),
             409, code="APPOINTMENT_REASSIGNMENT_REQUIRED")
        same_body = intent(unavailable, matching, agreement=False)
        reassigned = move(unavailable, "REASSIGNMENT", same_body)
        moved(unavailable, reassigned, matching)
        # The current backend reassignment fingerprint excludes actor; test that difference.
        assert move(unavailable, "REASSIGNMENT", same_body, actor="other_admin") == reassigned

        # A pending reassignment cannot bypass its old cutoff and needs agreement on time change.
        pending_source = next(
            item for item in requested if item["veterinarianId"] == first_vet
            and item["id"] != normal_source["id"]
        )
        pending_source = detail(pending_source)
        pending_destination = second_candidates[7]
        pending_body = intent(pending_source, pending_destination)
        fixture("appointment-state", appointmentId=pending_source["id"], cutoffPassed=True)
        move(pending_source, "REASSIGNMENT", pending_body, 409,
             code="APPOINTMENT_CONFIRMATION_CUTOFF_PASSED")
        assert detail(pending_source) == pending_source
        fixture("appointment-state", appointmentId=pending_source["id"], cutoffPassed=False)
        fixture("availability-state", slotId=pending_destination["id"], occupied=True, referenced=True)
        move(pending_source, "REASSIGNMENT", pending_body, 409, code="APPOINTMENT_SLOT_OCCUPIED")
        fixture("availability-state", slotId=pending_destination["id"], occupied=False, referenced=True)
        move(pending_source, "REASSIGNMENT",
             intent(pending_source, pending_destination, agreement=False),
             400, code="INVALID_APPOINTMENT_REQUEST")
        assert detail(pending_source) == pending_source
        moved_pending = move(pending_source, "REASSIGNMENT", pending_body)
        moved(pending_source, moved_pending, pending_destination)

        # Exceptional reassignment has no normal-rescheduling 60-day upper bound.
        request(
            "PATCH", "/veterinarians/" + first_vet + "/status", 200,
            body={"status": "ACTIVE"}, contract="/api/v1/veterinarians/{id}/status",
        )
        far_source = next(
            item for item in requested if item["veterinarianId"] == second_vet
            and item["id"] != cancel_source["id"]
        )
        far_source = change_status(far_source, "CONFIRMED", reason=None)
        fixture("appointment-veterinarian-unavailable", appointmentId=far_source["id"])
        far_source = detail(far_source)
        far_body = intent(far_source, far_candidate)
        far_result = move(far_source, "REASSIGNMENT", far_body)
        moved(far_source, far_result, far_candidate)
        move(far_source, "REASSIGNMENT", {**far_body, "reason": "Otra intención"},
             409, code="APPOINTMENT_IDEMPOTENCY_CONFLICT")
        history = events(far_result)
        assert any(
            event["eventType"] == "REASSIGNED" and event["actorType"] == "HUMAN"
            for event in history["items"]
        )
        assert datetime.now(BOGOTA).date() == today, "Business day changed; rerun the local verifier."
    finally:
        request("POST", "/../__simulation/reset", 204, actor=None)

    assert len(checks) <= 80, "Keep this verifier focused; do not pad HTTP counts."
    report = {
        "simulationOnly": True,
        "checkedAtUtc": datetime.now(timezone.utc).isoformat(),
        "openApiVersion": spec["info"]["version"],
        "requestCount": len(checks),
        "schemaValidatedCount": sum(check["schemaValidated"] for check in checks),
        "scope": [
            "cancellation and no-show time/permission/reason guards",
            "source and history unchanged after rejected moves",
            "rescheduling agreement, slot version, cutoff and day-60 window",
            "persistent replay returns current state; offset equivalence and nanosecond identity",
            "same-time and different-time reassignment, old cutoff and exceptional day-70 target",
        ],
        "limits": [
            "Local stand-in only; no authenticated requests to the real backend.",
            "No PostgreSQL locking, transaction, concurrency or persistence guarantee.",
            "No SMTP, queue, reminder or actual mailbox delivery claim.",
            "Explicit fixtures supply timing, inactivity and occupancy states.",
        ],
        "checks": checks,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"{len(checks)} peticiones verificadas, {report['schemaValidatedCount']} "
        "contra esquemas; solo simulación local; reset final aplicado."
    )


if __name__ == "__main__":
    main()
