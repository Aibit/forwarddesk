import { useSyncExternalStore } from 'react';
import { bridge } from '../backend/bridge';
import { sampleJobs, type Job, type LogEntry } from './data';

// Jobs: sample jobs (+ jobs created in this browser) in demo mode; Firestore snapshot in live mode.
const KEY = 'fd.jobs.extra.v1';
const readExtra = (): Job[] => {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
};
// Step moves made in this browser (demo mode): { [jobId]: { step, log } }, applied over the sample and local bookings.
const MOVES = 'fd.jobs.moves.v1';
type Moves = Record<string, { step: string; log: LogEntry[] }>;
const readMoves = (): Moves => {
  try {
    const r = JSON.parse(localStorage.getItem(MOVES) || '{}');
    return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  } catch {
    return {};
  }
};
const applyMoves = (list: Job[]) => {
  const m = readMoves();
  return list.map((j) => (m[j.id] ? { ...j, step: m[j.id].step, log: [...j.log, ...m[j.id].log] } : j));
};
const demoJobs = () => applyMoves([...readExtra(), ...sampleJobs()]);
let jobs: Job[] = typeof localStorage === 'undefined' ? [] : demoJobs();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const useJobs = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => jobs);
export const getJobs = () => jobs;
export const jobsStore = {
  hydrate(list: Job[]) {
    jobs = list;
    emit();
  },
  reload() {
    jobs = demoJobs();
    emit();
  },
  async create(j: Job) {
    if (bridge.w) {
      await bridge.w.createJob(j);
      return;
    }
    const extra = [j, ...readExtra()];
    try {
      localStorage.setItem(KEY, JSON.stringify(extra));
    } catch { /* full */ }
    jobs = [j, ...jobs];
    emit();
  },
  /** Move a booking to another step (the drawer's "Update client" action) and note it in the booking log. */
  async setStep(id: string, step: string, entry: LogEntry) {
    if (bridge.w) {
      await bridge.w.setJobStep(id, step, entry);
      return;
    }
    const m = readMoves();
    m[id] = { step, log: [...(m[id]?.log ?? []), entry] };
    try {
      localStorage.setItem(MOVES, JSON.stringify(m));
    } catch { /* full */ }
    jobs = jobs.map((j) => (j.id === id ? { ...j, step, log: [...j.log, entry] } : j));
    emit();
  },
  approveDraftBl(id: string) {
    bridge.w?.approveDraftBl(id);
  },
};
