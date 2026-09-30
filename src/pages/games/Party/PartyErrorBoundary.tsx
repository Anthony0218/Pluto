import { Component, type ErrorInfo, type ReactNode } from "react";

// Last line of defence for the Pluto Party screens: a rendering bug shows a recoverable screen instead
// of a blank page. Details go to the console only. The connection lives inside the boundary, so
// "Try again" remounts it and the saved session token restores the player's seat.
export default class PartyErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Pluto Party UI error:", error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="pp-page">
        <section className="pp-card pp-fatal" role="alert">
          <span className="pp-eyebrow">SOMETHING WENT SIDEWAYS</span>
          <h1>The party screen hit a snag.</h1>
          <p>
            Your seat is kept on the server for a while. Try again to reconnect, or reload the page.
          </p>
          <div className="pp-fatal-actions">
            <button className="pp-primary" onClick={() => this.setState({ failed: false })}>
              Try again
            </button>
            <button onClick={() => location.reload()}>Reload</button>
            <a href="/games">Return home</a>
          </div>
        </section>
      </main>
    );
  }
}
