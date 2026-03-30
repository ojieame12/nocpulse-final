'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PanelHeader } from '../ui/PanelHeader';
import { useAppTheme } from '../layout/WorkspaceShell';

interface AddFieldPanelProps {
  onClose?: () => void;
  initialTab?: string;
}

const tabs = ['Upload CSV', 'Single LLD Lookup', 'Upload KML', 'Notes'];

export function AddFieldPanel({ onClose, initialTab = 'Single LLD Lookup' }: AddFieldPanelProps) {
  useAppTheme(); // register theme context for CSS-driven dark mode
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="panel">
      <PanelHeader title="ADD FIELD" onClose={onClose} />
      <div className="panel__body add-field__body">
        {/* Title block */}
        <div className="add-field__title-block">
          <h2 className="add-field__title">New Field</h2>
          <p className="add-field__subtitle">
            Define a new field boundary and assign crop information
          </p>
        </div>

        {/* Underline tab bar */}
        <div className="add-field__tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`add-field__tab${activeTab === tab ? ' add-field__tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Single LLD Lookup' && (
          <>
            {/* FIELD IDENTITY */}
            <div className="add-field__section">
              <span className="add-field__section-header">FIELD IDENTITY</span>
              <Input label="Field Name" placeholder="e.g. North Quarter A" />
              <Input label="Legal Land Description" placeholder="e.g. SE 25-010-17 W4M" />
            </div>

            {/* CROP ASSIGNMENT */}
            <div className="add-field__section">
              <span className="add-field__section-header">CROP ASSIGNMENT</span>
              <Input label="Crop Type" placeholder="Select crop..." />
              <Input label="Variety" placeholder="e.g. InVigor L233P" />
              <Input label="Seeding Date" placeholder="Select date..." type="date" />
            </div>

            {/* Actions */}
            <div className="add-field__actions">
              <Button variant="panel-primary" icon={Plus}>
                Create Field
              </Button>
              <button
                type="button"
                className="add-field__cancel"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
