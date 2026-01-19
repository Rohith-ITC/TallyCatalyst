import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const TreeViewModal = ({ isOpen, onClose, data, title, valuePrefix = '₹', formatValue }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !data || !svgRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    // Convert stacked bar chart data to tree structure
    const convertToTree = (chartData) => {
      const root = {
        name: title || 'Root',
        value: 0,
        children: []
      };

      chartData.forEach(item => {
        const totalValue = item.segments?.reduce((sum, seg) => sum + (seg.value || 0), 0) || item.value || 0;
        root.value += totalValue;

        const node = {
          name: item.label,
          value: totalValue,
          children: item.segments?.map(segment => ({
            name: segment.label || 'Segment',
            value: segment.value || 0,
            color: segment.color || '#3b82f6'
          })) || []
        };

        root.children.push(node);
      });

      return root;
    };

    const root = d3.hierarchy(convertToTree(data));
    root.sum(d => d.value);

    // Get container dimensions with fallback - use a small delay to ensure container is rendered
    const getDimensions = () => {
      if (containerRef.current) {
        return {
          width: Math.max(800, containerRef.current.clientWidth - 40),
          height: Math.max(600, containerRef.current.clientHeight - 200)
        };
      }
      return { width: 1200, height: 800 };
    };

    const { width, height } = getDimensions();

    // Calculate base spacing
    const baseVerticalSpacing = 50; // Base space between sibling nodes (vertical)
    const baseHorizontalSpacing = 500; // Base space between parent and child levels (horizontal)
    
    const tree = d3.tree()
      .nodeSize([baseVerticalSpacing, baseHorizontalSpacing]);

    const treeData = tree(root);
    
    // Calculate the bounds of the tree
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    treeData.descendants().forEach(d => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    });
    
    const treeWidth = maxY - minY;
    const treeHeight = maxX - minX;
    
    // Calculate scale to fit vertically (with padding)
    const verticalPadding = 80;
    const availableHeight = height - verticalPadding;
    const verticalScale = treeHeight > 0 ? availableHeight / treeHeight : 1;
    
    // Apply vertical scaling to node positions
    treeData.descendants().forEach(d => {
      d.x = d.x * verticalScale;
    });
    
    // Recalculate bounds after scaling
    minX = Infinity;
    maxX = -Infinity;
    treeData.descendants().forEach(d => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
    });
    
    // Set SVG dimensions - make it wide enough for horizontal scroll if needed
    const svgWidth = Math.max(width, treeWidth + 200);
    const svgHeight = height;
    
    const svg = d3.select(svgRef.current)
      .attr('width', svgWidth)
      .attr('height', svgHeight);
    
    // Center the tree vertically and horizontally with padding
    const padding = 40;
    const offsetX = padding - minX;
    const offsetY = (svgWidth - treeWidth) / 2 - minY;
    
    const g = svg.append('g')
      .attr('transform', `translate(${offsetY}, ${offsetX})`);

    // Links
    const links = g.selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x))
      .style('fill', 'none')
      .style('stroke', '#cbd5e1')
      .style('stroke-width', 2);

    // Nodes
    const nodes = g.selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    // Node circles
    nodes.append('circle')
      .attr('r', d => {
        const baseRadius = d.depth === 0 ? 20 : 12;
        const valueFactor = Math.sqrt(d.data.value) / 100;
        return Math.max(baseRadius, Math.min(baseRadius + valueFactor, d.depth === 0 ? 30 : 18));
      })
      .style('fill', d => d.data.color || (d.depth === 0 ? '#3b82f6' : '#10b981'))
      .style('stroke', '#fff')
      .style('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).style('opacity', 0.7);
        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tree-tooltip')
          .style('position', 'absolute')
          .style('background', '#1e293b')
          .style('color', '#fff')
          .style('padding', '8px 12px')
          .style('border-radius', '6px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', 10000)
          .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)')
          .html(`
            <strong>${d.data.name}</strong><br/>
            ${formatValue ? formatValue(d.data.value, valuePrefix) : `${valuePrefix}${d.data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          `);
      })
      .on('mousemove', function(event) {
        const tooltip = d3.select('.tree-tooltip');
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseleave', function() {
        d3.select(this).style('opacity', 1);
        d3.select('.tree-tooltip').remove();
      });

    // Node labels
    nodes.append('text')
      .attr('dy', '.35em')
      .attr('x', d => d.children ? -13 : 13)
      .style('text-anchor', d => d.children ? 'end' : 'start')
      .style('font-size', d => d.depth === 0 ? '14px' : '12px')
      .style('fill', '#1e293b')
      .style('font-weight', d => d.depth === 0 ? '600' : '500')
      .text(d => {
        const name = d.data.name;
        const value = formatValue ? formatValue(d.data.value, valuePrefix) : `${valuePrefix}${d.data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `${name}: ${value}`;
      });

    // Zoom behavior - apply to the g element with initial transform
    const initialTransform = d3.zoomIdentity.translate(offsetY, offsetX);
    
    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    // Set initial transform
    svg.call(zoom.transform, initialTransform);

    // Cleanup function
    return () => {
      d3.select('.tree-tooltip').remove();
    };

  }, [isOpen, data, title, valuePrefix, formatValue]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '95vw',
          height: '90vh',
          maxWidth: '1400px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
            {title || 'Tree View'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              borderRadius: '50%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s ease',
              width: '36px',
              height: '36px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
              e.currentTarget.style.color = '#1e293b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }}
            title="Close"
          >
            <span className="material-icons" style={{ fontSize: '24px' }}>close</span>
          </button>
        </div>

        {/* SVG Container */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc'
          }}
        >
          <svg 
            ref={svgRef} 
            style={{ 
              border: '1px solid #e2e8f0', 
              borderRadius: '8px',
              background: '#ffffff',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
            }} 
          />
        </div>
      </div>
    </div>
  );
};

export default TreeViewModal;

