import { create } from "zustand";

export interface ReportDraft {
  lat: number | null;
  lon: number | null;
  gpsAccM: number | null;
  bearingDeg: number | null;
  bearingAccDeg: number | null;
  takenAt: string | null;
  photoUri: string | null;
  photoMime: string | null;
}

interface DraftStore extends ReportDraft {
  set: (patch: Partial<ReportDraft>) => void;
  reset: () => void;
}

const empty: ReportDraft = {
  lat: null,
  lon: null,
  gpsAccM: null,
  bearingDeg: null,
  bearingAccDeg: null,
  takenAt: null,
  photoUri: null,
  photoMime: null,
};

export const useReportDraft = create<DraftStore>((set) => ({
  ...empty,
  set: (patch) => set(patch),
  reset: () => set(empty),
}));
