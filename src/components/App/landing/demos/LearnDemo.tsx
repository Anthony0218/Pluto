import { learningPaths, learningSubjects } from "@/data/learningCatalog";
import { ui, useUiLanguage } from "@/i18n/ui";
import { landingBooks } from "../../planetary/universeCatalog";
import DemoFrame from "./DemoFrame";

/** One book: what is inside it. */
export default function LearnDemo({ bookId }: { bookId: string }) {
  useUiLanguage();
  const book = landingBooks.find(item => item.id === bookId);
  if (!book) return null;
  const path = learningPaths.find(item => item.id === bookId);
  const contents = path?.topics ?? [learningSubjects.find(item => item.id === bookId)?.resourceLabel].filter((label): label is string => !!label);
  return <DemoFrame tone="learn" title={ui(book.title)}>
    <ul className="book-contents">{contents.map(topic => <li key={topic}>{ui(topic)}</li>)}</ul>
  </DemoFrame>;
}
