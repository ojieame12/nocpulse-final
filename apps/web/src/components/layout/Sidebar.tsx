"use client";

import { Search, Plus, Ellipsis, MapPin } from "lucide-react";

const FILTER_OPTIONS = ["All", "Healthy", "Alerts", "New"] as const;

export interface SidebarFieldItem {
  id: string;
  name: string;
  area: string;
  crop?: string;
  alertCount?: number;
  status?: "healthy" | "stressed" | "warning" | "pending";
}

export interface SidebarProps {
  fields: SidebarFieldItem[];
  activeFieldId?: string;
  onFieldSelect?: (id: string) => void;
  onAddField?: () => void;
  filter?: string;
  onFilterChange?: (filter: string) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
}

export function Sidebar({
  fields,
  activeFieldId,
  onFieldSelect,
  onAddField,
  filter = 'All',
  onFilterChange,
  search = '',
  onSearchChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__section-header">
        <span className="sidebar__section-label">Fields ({fields.length})</span>
        <button className="sidebar__add-btn" onClick={onAddField}>
          <Plus size={10} strokeWidth={2.5} /> Add
        </button>
      </div>

      <div className="sidebar__search">
        <div className="sidebar__search-input">
          <Search size={12} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      </div>

      <div className="sidebar__filter-bar">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option}
            className={`sidebar__filter-pill${filter === option ? " sidebar__filter-pill--active" : ""}`}
            onClick={() => onFilterChange?.(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="sidebar__field-list">
        {fields.length === 0 && (
          <div className="sidebar__empty">
            <MapPin size={48} strokeWidth={1.5} className="sidebar__empty-icon" />
            <span className="sidebar__empty-title">No fields yet</span>
            <p className="sidebar__empty-desc">
              Add your first field to start monitoring crop health and soil conditions.
            </p>
            <button className="btn btn--primary" onClick={onAddField}>
              Add Field
            </button>
          </div>
        )}
        {fields.map((field) => (
          <div
            key={field.id}
            className={`sidebar__field-item${activeFieldId === field.id ? " sidebar__field-item--active" : ""}`}
            onClick={() => onFieldSelect?.(field.id)}
          >
            <div className="sidebar__field-item-top">
              <span className="sidebar__field-name">{field.name}</span>
              <div className="sidebar__field-actions">
                {field.alertCount != null && field.alertCount > 0 && (
                  <span className="sidebar__alert-badge">{field.alertCount}</span>
                )}
                <button
                  className="sidebar__menu-btn"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="More options"
                >
                  <Ellipsis size={14} />
                </button>
              </div>
            </div>
            <span className="sidebar__field-area">
              {field.crop ? `${field.crop} · ${field.area}` : field.area}
            </span>
            {field.status && (
              <div className="sidebar__status">
                {field.status === "pending" ? (
                  <span className="sidebar__status-text sidebar__status-text--pending">
                    Awaiting clear pass
                  </span>
                ) : (
                  <>
                    <span className={`sidebar__status-dot sidebar__status-dot--${field.status}`} />
                    <span className={`sidebar__status-text sidebar__status-text--${field.status}`}>
                      {field.status === "healthy"
                        ? "Healthy"
                        : field.status === "stressed"
                          ? "Stressed"
                          : "Warning"}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
