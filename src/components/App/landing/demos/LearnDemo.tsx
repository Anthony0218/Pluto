import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import { BookArt } from "../../planetary/PlanetScene";
import { landingBookTitle } from "../../planetary/landingCopy";
import { landingBooks } from "../../planetary/universeCatalog";
import { bookTopics } from "../flybyCatalog";
import DemoFrame from "./DemoFrame";

/** One book: what is inside it. A subject book (Math, Music) shows the books on its shelf, each one a way in. */
export default function LearnDemo({ bookId }: { bookId: string }) {
  const { language } = useUiLanguage();
  const book = landingBooks.find(item => item.id === bookId);
  if (!book) return null;
  return <DemoFrame tone="learn" title={ui(book.title)}>
    {book.books
      ? <ul className="book-shelf">{book.books.map(item => <li key={item.id}>
        <Link to={item.route} aria-label={`${ui("Open")} ${ui(item.title)}`}>
          <span className="book-shelf-art"><BookArt title={landingBookTitle(language, item.design)} design={item.design} /></span>
          <span>{ui(item.title)}</span>
        </Link>
      </li>)}</ul>
      : <ul className="book-contents">{bookTopics(book).map(topic => <li key={topic}>{ui(topic)}</li>)}</ul>}
  </DemoFrame>;
}
