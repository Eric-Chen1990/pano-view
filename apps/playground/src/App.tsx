import { matchPlaygroundRoute } from "./routes";

export function App() {
  const { Component } = matchPlaygroundRoute(window.location.pathname);
  return <Component />;
}
