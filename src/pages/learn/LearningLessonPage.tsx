import { useParams } from "react-router-dom";
import { learningLessons } from "@/data/learningCatalog";
import LessonLayout from "@/components/learning/LessonLayout";
import NotFoundPage from "@/pages/general/NotFoundPage";
import PercentageLesson from "@/components/learning/PercentageLesson";
import MathFoundationLesson from "@/components/learning/MathFoundationLesson";

export default function LearningLessonPage({ introduction = false }: { introduction?: boolean }) {
  const { subjectId, pathId, lessonId } = useParams();
  const lesson = learningLessons.find(item => introduction ? item.id === "getting-started" : item.id === lessonId && item.subjectId === subjectId && item.pathId === pathId);
  if (!lesson) return <NotFoundPage />;
  if (lesson.subjectId === "math" && lesson.pathId === "percentages") return <PercentageLesson key={lesson.id} lesson={lesson} />;
  return lesson.subjectId === "math" && lesson.pathId === "foundations" ? <MathFoundationLesson key={lesson.id} lesson={lesson} /> : <LessonLayout key={lesson.id} lesson={lesson} />;
}
