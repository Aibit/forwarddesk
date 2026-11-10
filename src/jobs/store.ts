import { useSyncExternalStore } from 'react';
import { bridge } from '../backend/bridge';
import { sampleJobs, type Job } from './data';

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
const demoJobs = () => [...readExtra(), ...sampleJobs()];
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
  approveDraftBl(id: string) {
    bridge.w?.approveDraftBl(id);
  },
};
