'use client';

interface PillTabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function PillTabBar({ tabs, activeTab, onTabChange }: PillTabBarProps) {
  return (
    <div className="panel__pill-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`panel__pill-tab${tab === activeTab ? ' panel__pill-tab--active' : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
