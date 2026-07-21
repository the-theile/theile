"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createMeeting,
  deleteMeeting,
  loadMeetings,
  saveMeetings,
  upsertMeeting,
} from "@/lib/storage";
import type { CreateMeetingInput, Meeting } from "@/lib/types";

interface MeetingsContextValue {
  meetings: Meeting[];
  ready: boolean;
  addMeeting: (input?: CreateMeetingInput) => Meeting;
  updateMeeting: (meeting: Meeting) => void;
  removeMeeting: (id: string) => void;
  getById: (id: string) => Meeting | undefined;
}

const MeetingsContext = createContext<MeetingsContextValue | null>(null);

export function MeetingsProvider({ children }: { children: React.ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMeetings(loadMeetings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveMeetings(meetings);
  }, [meetings, ready]);

  const addMeeting = useCallback((input?: CreateMeetingInput) => {
    const m = createMeeting(input);
    setMeetings((prev) => upsertMeeting(prev, m));
    return m;
  }, []);

  const updateMeeting = useCallback((meeting: Meeting) => {
    setMeetings((prev) => upsertMeeting(prev, meeting));
  }, []);

  const removeMeeting = useCallback((id: string) => {
    setMeetings((prev) => deleteMeeting(prev, id));
  }, []);

  const getById = useCallback(
    (id: string) => meetings.find((m) => m.id === id),
    [meetings]
  );

  const value = useMemo(
    () => ({
      meetings,
      ready,
      addMeeting,
      updateMeeting,
      removeMeeting,
      getById,
    }),
    [meetings, ready, addMeeting, updateMeeting, removeMeeting, getById]
  );

  return (
    <MeetingsContext.Provider value={value}>{children}</MeetingsContext.Provider>
  );
}

export function useMeetingsContext() {
  const ctx = useContext(MeetingsContext);
  if (!ctx) {
    throw new Error("useMeetingsContext must be used within MeetingsProvider");
  }
  return ctx;
}
