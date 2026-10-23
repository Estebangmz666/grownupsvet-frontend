import { useEffect, useState } from "react";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
  type Appointment,
  type AppointmentEvent,
  type Page,
} from "@grownupsvet/api-client";
import {
  getAdministrativeAppointment,
  listAdministrativeAppointmentEvents,
} from "@api-client/administrativeAppointments.api";
import {
  administrativeAppointmentOperationError,
  type AdministrativeAppointmentOperationError,
} from "../administrativeAppointmentsPresentation";

interface AdministrativeAppointmentReadState {
  readKey: string;
  appointment: Appointment | null;
  events: Page<AppointmentEvent> | null;
  loading: boolean;
  error: AdministrativeAppointmentOperationError | null;
}

/** A new consultation confirms both the current detail and the requested history page. */
export function useAdministrativeAppointment(
  appointmentId: string,
  historyPage: number,
  revision: number,
) {
  const readKey = `${appointmentId}:${historyPage}:${revision}`;
  const [state, setState] = useState<AdministrativeAppointmentReadState>({
    readKey,
    appointment: null,
    events: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    const context = getApiRequestContext();
    const controller = new AbortController();
    const requestContext = { ...context, signal: controller.signal };
    let mounted = true;
    setState({
      readKey,
      appointment: null,
      events: null,
      loading: true,
      error: null,
    });
    void Promise.all([
      getAdministrativeAppointment(appointmentId, requestContext),
      listAdministrativeAppointmentEvents(
        appointmentId,
        { page: historyPage, size: 20 },
        requestContext,
      ),
    ])
      .then(([appointment, events]) => {
        if (mounted && isApiRequestContextCurrent(context)) {
          setState({
            readKey,
            appointment,
            events,
            loading: false,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (mounted && isApiRequestContextCurrent(context)) {
          setState({
            readKey,
            appointment: null,
            events: null,
            loading: false,
            error: administrativeAppointmentOperationError(error),
          });
        }
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [appointmentId, historyPage, readKey]);
  // Never expose a prior appointment or history page during the next render.
  return state.readKey === readKey
    ? state
    : { readKey, appointment: null, events: null, loading: true, error: null };
}
