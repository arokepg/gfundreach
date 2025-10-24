const FilterTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'friends', label: 'Friends' },
  ];

  return (
    <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 md:px-6 py-2 rounded-full font-medium transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === tab.id ? 'pill-active' : 'pill'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default FilterTabs;
