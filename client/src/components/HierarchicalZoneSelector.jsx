import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

const HierarchicalZoneSelector = ({
  zones,
  selectedZoneIds,
  onChange,
  label = "Applicable Zones"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState({});
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tree = useMemo(() => {
    const states = zones.filter(z => z.zoneLevel === 'state' || !z.zoneLevel);
    const cities = zones.filter(z => z.zoneLevel === 'city');
    const micros = zones.filter(z => z.zoneLevel === 'micro');

    return states.map(state => {
      const stateCities = cities.filter(c => {
        const pId = c.parentZone?._id || c.parentZone;
        return pId?.toString() === (state._id || state.id)?.toString();
      });

      const cityNodes = stateCities.map(city => {
        const cityMicros = micros.filter(m => {
          const pId = m.parentZone?._id || m.parentZone;
          return pId?.toString() === (city._id || city.id)?.toString();
        });

        return { ...city, children: cityMicros };
      });

      return { ...state, children: cityNodes };
    });
  }, [zones]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
    const lowerQuery = searchQuery.toLowerCase();

    const filterNodes = (nodes) => {
      return nodes.map(node => {
        const matchesSelf = node.name?.toLowerCase().includes(lowerQuery) || node.city?.toLowerCase().includes(lowerQuery);
        let filteredChildren = [];
        if (node.children) {
          filteredChildren = filterNodes(node.children);
        }
        const matchesChildren = filteredChildren.length > 0;

        if (matchesSelf || matchesChildren) {
          return {
            ...node,
            children: filteredChildren,
            forceExpanded: true
          };
        }
        return null;
      }).filter(Boolean);
    };

    return filterNodes(tree);
  }, [tree, searchQuery]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isSelected = (id) => (selectedZoneIds || []).includes(id);

  const getAllDescendantIds = (node) => {
    let ids = [node._id || node.id];
    if (node.children) {
      node.children.forEach(child => {
        ids = [...ids, ...getAllDescendantIds(child)];
      });
    }
    return ids;
  };

  const toggleSelection = (node) => {
    const nodeId = node._id || node.id;
    const descendantIds = getAllDescendantIds(node);
    const currentlySelected = isSelected(nodeId);
    
    let newSelectedIds = [...(selectedZoneIds || [])];
    
    if (currentlySelected) {
      newSelectedIds = newSelectedIds.filter(id => !descendantIds.includes(id));
    } else {
      newSelectedIds = Array.from(new Set([...newSelectedIds, ...descendantIds]));
    }
    
    onChange(newSelectedIds);
  };

  const renderNode = (node, depth = 0) => {
    const nodeId = node._id || node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!(expandedNodes[nodeId] || node.forceExpanded);
    const checked = isSelected(nodeId);

    return (
      <div key={nodeId} className="select-none">
        <div
          className="flex items-center hover:bg-gray-50 py-1.5 px-2 rounded-lg cursor-pointer transition-colors"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => toggleSelection(node)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(nodeId, e)}
              className="p-1 hover:bg-gray-200 rounded mr-1 transition-transform duration-200"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}

          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary mr-2 cursor-pointer"
          />

          <span className={`text-xs font-semibold text-secondary capitalize ${checked ? 'text-primary font-bold' : ''}`}>
            {node.name}
          </span>
          <span className="text-[9px] bg-gray-100 text-gray-500 ml-1.5 px-1.5 py-0.2 rounded font-black uppercase tracking-wider scale-90">
            {node.zoneLevel || 'state'}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-sm font-medium text-secondary mb-1.5">
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm shadow-sm hover:border-gray-400 transition-all font-semibold"
      >
        <span className="text-gray-700 truncate font-semibold">
          {(selectedZoneIds || []).length === 0 ? 'Select Zones (Leave empty for Global)' : `${(selectedZoneIds || []).length} Zones Selected`}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-3 max-h-80 flex flex-col shrink-0">
          <div className="relative mb-2 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by state, city, or micro zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-semibold text-gray-900 bg-gray-50"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {filteredTree.length === 0 ? (
              <div className="text-xs text-gray-400 italic text-center py-6">
                No matching zones found.
              </div>
            ) : (
              filteredTree.map(node => renderNode(node, 0))
            )}
          </div>
        </div>
      )}

      {(() => {
        const matchedZones = (selectedZoneIds || []).map(id => zones.find(z => (z._id || z.id)?.toString() === id.toString())).filter(Boolean);
        if (matchedZones.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-24 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-250/60 shadow-inner">
            {matchedZones.map(zone => {
              const id = zone._id || zone.id;
              let badgeColor = 'bg-teal-50 text-teal-800 border-teal-200/60';
              if (zone.zoneLevel === 'city') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200/60';
              if (zone.zoneLevel === 'micro') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200/60';

              return (
                <span key={id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border shadow-sm capitalize ${badgeColor}`}>
                  <span>{zone.name} ({zone.zoneLevel?.toUpperCase() || 'STATE'})</span>
                  <button
                    type="button"
                    onClick={() => {
                      const descendantIds = getAllDescendantIds(zone);
                      const newSelectedIds = (selectedZoneIds || []).filter(selectedId => !descendantIds.includes(selectedId));
                      onChange(newSelectedIds);
                    }}
                    className="ml-1 inline-flex items-center justify-center focus:outline-none text-slate-450 hover:text-slate-650"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};

export default HierarchicalZoneSelector;
