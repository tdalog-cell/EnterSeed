import React from 'react';
import { Button, Notice } from './ui';

export class ViewBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('Workspace view failed:', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="max-w-lg mx-auto py-12 space-y-5"><Notice tone="error">This page could not open. Your saved information is still available.</Notice><Button onClick={() => window.location.reload()}>Reload workspace</Button></div>;
  }
}

export const ViewLoading = () => <div role="status" aria-label="Loading page" className="space-y-5 py-2"><div className="skeleton h-9 w-56 rounded-lg" /><div className="skeleton h-4 w-3/4 rounded" /><div className="grid sm:grid-cols-2 gap-5"><div className="skeleton h-52 rounded-2xl" /><div className="skeleton h-52 rounded-2xl" /></div><span className="sr-only">Loading your workspace…</span></div>;
