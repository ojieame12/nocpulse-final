'use client';

/* Types preserved from archived ActionTab. Component stub pending redesign. */

export interface ActionTag { label: string; color: 'green' | 'red' | 'yellow'; detail?: string; }
export interface ActionQAItem { question: string; answer?: string; tags?: ActionTag[]; }
export interface FieldActionProps {
  name: string; lld: string; recommendation: string; dueDate: string;
  explanation: string; urgency: string; confidence: string;
  signalCount: number; signals: ActionTag[]; questions: ActionQAItem[];
}

export function ActionTab(_props: { field?: FieldActionProps; onClose?: () => void }) {
  return null; // Redesign pending
}
