"use client";
import { useParams } from "next/navigation";
import Chat from "../Chat";

export default function ChatPage() {
  const params = useParams();
  return <Chat id={String(params.id)} />;
}
