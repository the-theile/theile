"use client";

import { use } from "react";
import { MeetingView } from "@/components/MeetingView";

export default function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <MeetingView id={id} />;
}
