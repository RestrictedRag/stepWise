"use client";
import { useParams } from "next/navigation";
import Lesson from "../Lesson";
export default function LessonPage() {
  const params = useParams();
  return <Lesson id={String(params.id)} />;
}
