import {
  isApiRequestContextCurrent,
  listPets,
  type ApiRequestContext,
  type Page,
  type Pet,
} from "@grownupsvet/api-client";

export const APPOINTMENT_PET_PAGE_SIZE = 20;

export interface AppointmentPetPageState {
  items: Pet[];
  totalElements: number;
  hasMore: boolean;
  loading: boolean;
  error: unknown | null;
}

export function emptyAppointmentPetPage(): AppointmentPetPageState {
  return {
    items: [],
    totalElements: 0,
    hasMore: false,
    loading: false,
    error: null,
  };
}

/** One progressive selector, bound to the session that opened it. */
export function createAppointmentPetPager(
  onChanged: (state: AppointmentPetPageState) => void,
) {
  let generation = 0;
  let context: ApiRequestContext | undefined;
  let nextPage = 0;
  let state = emptyAppointmentPetPage();

  const publish = (next: AppointmentPetPageState) => {
    state = next;
    onChanged(state);
  };

  const load = async (page: number): Promise<Page<Pet> | undefined> => {
    const requestGeneration = generation;
    const requestContext = context;
    const isCurrent = () =>
      requestGeneration === generation &&
      !!requestContext &&
      isApiRequestContextCurrent(requestContext);
    if (!requestContext || !isCurrent()) return undefined;
    publish({ ...state, loading: true, error: null });
    try {
      const result = await listPets(
        { active: true, page, size: APPOINTMENT_PET_PAGE_SIZE },
        requestContext,
      );
      if (!isCurrent()) return undefined;
      const petsById = new Map(state.items.map((pet) => [pet.id, pet]));
      for (const pet of result.items) petsById.set(pet.id, pet);
      nextPage = result.page + 1;
      publish({
        items: [...petsById.values()],
        totalElements: result.totalElements,
        hasMore: nextPage < result.totalPages,
        loading: false,
        error: null,
      });
      return result;
    } catch (error) {
      if (!isCurrent()) return undefined;
      publish({ ...state, loading: false, error });
      throw error;
    }
  };

  return {
    reset(requestContext: ApiRequestContext) {
      generation += 1;
      context = requestContext;
      nextPage = 0;
      state = emptyAppointmentPetPage();
      return load(0);
    },
    async loadMore() {
      if (state.loading || !state.hasMore) return;
      try {
        await load(nextPage);
      } catch {
        // Keep previous options and expose a retry for this same page.
      }
    },
    cancel() {
      generation += 1;
      context = undefined;
    },
  };
}
