'use client';

import { Edit3, Upload, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PanelHeader } from '../ui/PanelHeader';

interface EditFieldPanelProps {
  onClose?: () => void;
}

export function EditFieldPanel({ onClose }: EditFieldPanelProps) {
  return (
    <div className="panel">
      <PanelHeader title="EDIT FIELD" onClose={onClose} />
      <div className="panel__body edit-field__body">
        {/* Title block */}
        <div className="edit-field__title-block">
          <h2 className="edit-field__title">North Quarter A</h2>
          <div className="edit-field__subtitle">
            <span className="edit-field__subtitle-label">Legal Land Description</span>
            <span className="edit-field__subtitle-value">SE 25-010-17 W4M</span>
          </div>
        </div>

        {/* FIELD DETAILS */}
        <div className="edit-field__section">
          <span className="edit-field__section-header">FIELD DETAILS</span>
          <Input label="Field Name" value="North Quarter A" />
          <Input label="Legal Land Description" value="SE 25-010-17 W4M" />
        </div>

        {/* LOCATION */}
        <div className="edit-field__section">
          <span className="edit-field__section-header">LOCATION</span>
          <Input label="Region" value="Central Alberta" />
          <div className="edit-field__row">
            <Input label="Latitude" value="51.0452" className="edit-field__half" />
            <Input label="Longitude" value="-110.6792" className="edit-field__half" />
          </div>
        </div>

        {/* CROP */}
        <div className="edit-field__section">
          <span className="edit-field__section-header">CROP</span>
          <Input label="Crop Type" value="Canola" />
          <Input label="Variety" value="InVigor L233P" />
          <Input label="Seeding Date" value="Apr 15, 2025" type="date" />
        </div>

        {/* BOUNDARY */}
        <div className="edit-field__section">
          <span className="edit-field__section-header">BOUNDARY</span>
          <div className="edit-field__boundary-area">
            <span className="edit-field__boundary-area-label">Area</span>
            <span className="edit-field__boundary-area-value">64.2 ha</span>
          </div>
          <div className="edit-field__row">
            <Button variant="panel-secondary" icon={Edit3}>Edit Boundary</Button>
            <Button variant="panel-secondary" icon={Upload}>Upload file</Button>
          </div>
        </div>

        {/* ACTIVITY */}
        <div className="edit-field__section">
          <span className="edit-field__section-header">ACTIVITY</span>
          <div className="edit-field__activity-rows">
            <div className="edit-field__activity-row">
              <span className="edit-field__activity-label">First capture</span>
              <span className="edit-field__activity-value">Jun 12, 2025</span>
            </div>
            <div className="edit-field__activity-row">
              <span className="edit-field__activity-label">Last capture</span>
              <span className="edit-field__activity-value">Mar 20, 2026</span>
            </div>
            <div className="edit-field__activity-row edit-field__activity-row--last">
              <span className="edit-field__activity-label">Captures</span>
              <span className="edit-field__activity-value">47</span>
            </div>
          </div>
        </div>

        {/* Save actions */}
        <div className="edit-field__actions">
          <Button variant="panel-primary">
            Save Changes
          </Button>
          <button type="button" className="edit-field__quickfit" onClick={onClose}>
            Quick fit
          </button>
        </div>

        {/* DANGER ZONE */}
        <div className="edit-field__danger-zone">
          <div className="edit-field__danger-separator" />
          <span className="edit-field__danger-label">DANGER ZONE</span>
          <p className="edit-field__danger-warning">
            Permanently delete this field and all associated monitoring data, alerts, and reports. This action cannot be undone.
          </p>
          <Button variant="danger" icon={Trash2}>Delete Field</Button>
        </div>
      </div>
    </div>
  );
}
